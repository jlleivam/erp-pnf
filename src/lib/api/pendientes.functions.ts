import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Nota: los conteos usan el cliente autenticado del usuario, así RLS filtra
// naturalmente por membresía de obra / empresa. Solo agregamos filtros de estado.

type ModuleCounts = Record<string, number>;

export type PendientesResult = {
  admin: ModuleCounts;
  obras: Record<string, ModuleCounts>;
};

async function safeCount(
  q: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  try {
    const { count, error } = (await q) as { count: number | null; error: unknown };
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export const getPendientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendientesResult> => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: roleRows }, { data: teamRows }] =
      await Promise.all([
        supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("obra_team").select("obra_id, role").eq("user_id", userId),
      ]);

    const companyId = profile?.company_id ?? null;
    const roles = new Set<string>((roleRows ?? []).map((r: any) => r.role));
    const isDirector = roles.has("director");
    const isAdmin = isDirector || roles.has("administrativo");
    const isSupervisor = isDirector || roles.has("supervisor");

    const obraIds = Array.from(
      new Set((teamRows ?? []).map((r: any) => r.obra_id as string)),
    );
    const obraRoles: Record<string, Set<string>> = {};
    for (const r of teamRows ?? []) {
      (obraRoles[(r as any).obra_id] ??= new Set()).add((r as any).role);
    }
    // Directores ven todas las obras de la empresa
    if (isDirector && companyId) {
      const { data: allObras } = await supabase
        .from("obras")
        .select("id")
        .eq("company_id", companyId);
      for (const o of allObras ?? []) {
        if (!obraIds.includes((o as any).id)) obraIds.push((o as any).id);
      }
    }

    const admin: ModuleCounts = {};

    if (isAdmin && companyId) {
      const [req, cxp, nom, fondos, reemb, gas, gastosOf, rentas] = await Promise.all([
        safeCount(
          supabase
            .from("requisiciones")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .in("estatus", ["enviada", "en_cotizacion", "pendiente_autorizacion"]),
        ),
        safeCount(
          supabase
            .from("cuentas_por_pagar")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .in("estatus", ["pendiente", "parcial"]),
        ),
        safeCount(
          supabase
            .from("obra_nominas")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("estatus", "cerrada"),
        ),
        safeCount(
          supabase
            .from("caja_chica_fondos")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("estatus", "autorizado"),
        ),
        safeCount(
          supabase
            .from("caja_chica_reembolsos")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("estatus", "enviado_admin"),
        ),
        safeCount(
          supabase
            .from("vales_gasolina")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .in("estatus", ["pendiente_autorizacion", "autorizado"]),
        ),
        safeCount(
          supabase
            .from("gastos_oficina")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("estatus", "pendiente_aprobacion"),
        ),
        safeCount(
          supabase
            .from("obra_rentas")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("estatus", "solicitada"),
        ),
      ]);

      admin["requisiciones"] = req;
      admin["cuentas-por-pagar"] = cxp;
      admin["nomina"] = nom;
      admin["caja-chica"] = fondos + reemb;
      admin["gasolinas"] = gas;
      admin["gastos-oficina"] = gastosOf;
      admin["rentas"] = rentas;
    }

    const obras: Record<string, ModuleCounts> = {};

    await Promise.all(
      obraIds.map(async (obraId) => {
        const rolesInObra = obraRoles[obraId] ?? new Set<string>();
        if (isDirector) {
          rolesInObra.add("residente");
          rolesInObra.add("supervisor");
          rolesInObra.add("administrativo");
        }
        const isResidente = rolesInObra.has("residente") || rolesInObra.has("auxiliar");
        const isSuperv = rolesInObra.has("supervisor") || isSupervisor;

        const c: ModuleCounts = {};

        const tasks: Array<Promise<void>> = [];

        // Requisiciones en obra
        tasks.push(
          (async () => {
            const statuses: string[] = isResidente
              ? ["borrador", "rechazada"]
              : isSuperv
                ? ["pendiente_autorizacion"]
                : [];
            if (!statuses.length) return;
            c["requisiciones"] = await safeCount(
              supabase
                .from("requisiciones")
                .select("id", { count: "exact", head: true })
                .eq("obra_id", obraId)
                .in("estatus", statuses as any),
            );
          })(),
        );


        // Almacén: OC pendientes de recibir
        tasks.push(
          (async () => {
            if (!isResidente) return;
            c["almacen-obra"] = await safeCount(
              supabase
                .from("ordenes_compra")
                .select("id", { count: "exact", head: true })
                .eq("obra_id", obraId)
                .in("estatus", ["autorizada", "enviada", "recibida_parcial"]),
            );
          })(),
        );

        // Rentas: borradores del residente
        tasks.push(
          (async () => {
            if (!isResidente) return;
            c["rentas"] = await safeCount(
              supabase
                .from("obra_rentas")
                .select("id", { count: "exact", head: true })
                .eq("obra_id", obraId)
                .eq("estatus", "borrador"),
            );
          })(),
        );

        // Gasolinas: vales por revisar
        tasks.push(
          (async () => {
            if (!isResidente && !isSuperv) return;
            const statuses: string[] = isSuperv
              ? ["pendiente_autorizacion"]
              : ["autorizado", "entregado"];
            c["gasolinas"] = await safeCount(
              supabase
                .from("vales_gasolina")
                .select("id", { count: "exact", head: true })
                .eq("obra_id", obraId)
                .in("estatus", statuses as any),
            );
          })(),
        );


        // Caja chica
        tasks.push(
          (async () => {
            if (isSuperv) {
              const [fondos, reemb] = await Promise.all([
                safeCount(
                  supabase
                    .from("caja_chica_fondos")
                    .select("id", { count: "exact", head: true })
                    .eq("obra_id", obraId)
                    .eq("estatus", "pendiente_autorizacion"),
                ),
                safeCount(
                  supabase
                    .from("caja_chica_reembolsos")
                    .select("id", { count: "exact", head: true })
                    .eq("obra_id", obraId)
                    .in("estatus", ["solicitado", "en_revision"]),
                ),
              ]);
              c["caja-chica"] = (c["caja-chica"] ?? 0) + fondos + reemb;
            }
            if (isResidente) {
              const [fondosR, reembR, gastosR] = await Promise.all([
                safeCount(
                  supabase
                    .from("caja_chica_fondos")
                    .select("id", { count: "exact", head: true })
                    .eq("obra_id", obraId)
                    .eq("estatus", "rechazado"),
                ),
                safeCount(
                  supabase
                    .from("caja_chica_reembolsos")
                    .select("id", { count: "exact", head: true })
                    .eq("obra_id", obraId)
                    .eq("estatus", "rechazado"),
                ),
                safeCount(
                  supabase
                    .from("caja_chica_gastos")
                    .select("id", { count: "exact", head: true })
                    .eq("obra_id", obraId)
                    .eq("estatus", "rechazado"),
                ),
              ]);
              c["caja-chica"] = (c["caja-chica"] ?? 0) + fondosR + reembR + gastosR;
            }
          })(),
        );

        // Tareas asignadas al usuario
        tasks.push(
          (async () => {
            c["tareas"] = await safeCount(
              supabase
                .from("obra_tareas")
                .select("id", { count: "exact", head: true })
                .eq("obra_id", obraId)
                .eq("asignado_a", userId)
                .neq("estatus", "completada"),
            );
          })(),
        );

        await Promise.all(tasks);

        // Limpia ceros
        for (const k of Object.keys(c)) if (!c[k]) delete c[k];
        if (Object.keys(c).length > 0) obras[obraId] = c;
      }),
    );

    return { admin, obras };
  });
