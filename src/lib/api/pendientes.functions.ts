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
  label: string,
  q: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  try {
    const { count, error } = (await q) as { count: number | null; error: unknown };
    if (error) {
      console.warn(`[pendientes] ${label}:`, (error as any)?.message ?? error);
      return 0;
    }
    return count ?? 0;
  } catch (e) {
    console.warn(`[pendientes] ${label} threw:`, (e as any)?.message ?? e);
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
        safeCount("admin.requisiciones",
          supabase
            .from("requisiciones")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .in("estatus", ["enviada", "en_cotizacion", "pendiente_autorizacion"]),
        ),
        safeCount("admin.cxp",
          supabase
            .from("cuentas_por_pagar")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .in("estatus", ["pendiente", "parcial"]),
        ),
        safeCount("admin.nomina",
          supabase
            .from("obra_nominas")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("estatus", "cerrada"),
        ),
        safeCount("admin.caja_chica.fondos",
          supabase
            .from("caja_chica_fondos")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("estatus", "autorizado"),
        ),
        safeCount("admin.caja_chica.reemb",
          supabase
            .from("caja_chica_reembolsos")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("estatus", "enviado_admin"),
        ),
        safeCount("admin.gasolinas",
          supabase
            .from("vales_gasolina")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .in("estatus", ["pendiente_autorizacion", "autorizado"]),
        ),
        safeCount("admin.gastos_oficina",
          supabase
            .from("gastos_oficina")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("estatus", "pendiente_aprobacion"),
        ),
        safeCount("admin.rentas",
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

        // Requisiciones
        tasks.push(
          (async () => {
            const statuses: string[] = isResidente
              ? ["borrador", "rechazada"]
              : isSuperv
                ? ["pendiente_autorizacion"]
                : [];
            if (!statuses.length) return;
            c["requisiciones"] = await safeCount("obra.requisiciones",
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
            c["almacen-obra"] = await safeCount("obra.almacen",
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
            c["rentas"] = await safeCount("obra.rentas",
              supabase
                .from("obra_rentas")
                .select("id", { count: "exact", head: true })
                .eq("obra_id", obraId)
                .eq("estatus", "borrador"),
            );
          })(),
        );

        // Gasolinas
        tasks.push(
          (async () => {
            if (!isResidente && !isSuperv) return;
            const statuses: string[] = isSuperv
              ? ["pendiente_autorizacion"]
              : ["autorizado", "entregado"];
            c["gasolinas"] = await safeCount("obra.gasolinas",
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
                safeCount("obra.cc.fondos.sup",
                  supabase
                    .from("caja_chica_fondos")
                    .select("id", { count: "exact", head: true })
                    .eq("obra_id", obraId)
                    .eq("estatus", "pendiente_autorizacion"),
                ),
                safeCount("obra.cc.reemb.sup",
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
                safeCount("obra.cc.fondos.res",
                  supabase
                    .from("caja_chica_fondos")
                    .select("id", { count: "exact", head: true })
                    .eq("obra_id", obraId)
                    .eq("estatus", "rechazado"),
                ),
                safeCount("obra.cc.reemb.res",
                  supabase
                    .from("caja_chica_reembolsos")
                    .select("id", { count: "exact", head: true })
                    .eq("obra_id", obraId)
                    .eq("estatus", "rechazado"),
                ),
                safeCount("obra.cc.gastos.res",
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

        // Tareas
        tasks.push(
          (async () => {
            c["tareas"] = await safeCount("obra.tareas",
              supabase
                .from("obra_tareas")
                .select("id", { count: "exact", head: true })
                .eq("obra_id", obraId)
                .eq("asignado_a", userId)
                .in("estatus", ["pendiente", "en_progreso"]),
            );
          })(),
        );

        // Presupuestos
        tasks.push(
          (async () => {
            if (isSuperv) {
              c["presupuesto"] = await safeCount("obra.presupuesto.sup",
                supabase
                  .from("obra_presupuestos")
                  .select("id", { count: "exact", head: true })
                  .eq("obra_id", obraId)
                  .eq("estatus", "solicitada"),
              );
            }
          })(),
        );

        // Estimaciones (admin: cerradas pendientes de pago; supervisor las revisa)
        tasks.push(
          (async () => {
            if (isSuperv) {
              c["estimaciones"] = await safeCount("obra.estimaciones",
                supabase
                  .from("obra_estimaciones")
                  .select("id", { count: "exact", head: true })
                  .eq("obra_id", obraId)
                  .eq("estatus", "cerrada"),
              );
            }
          })(),
        );

        // Destajos / Subcontratos: docs enviados a autorizar
        tasks.push(
          (async () => {
            if (!isSuperv) return;
            const [dest, sub] = await Promise.all([
              safeCount("obra.destajos",
                supabase
                  .from("obra_destajo_presupuestos")
                  .select("id", { count: "exact", head: true })
                  .eq("estatus", "enviado"),
              ),
              safeCount("obra.subcontratos",
                supabase
                  .from("obra_subcontrato_presupuestos")
                  .select("id", { count: "exact", head: true })
                  .eq("estatus", "enviado"),
              ),
            ]);
            if (dest) c["destajos"] = dest;
            if (sub) c["subcontratos"] = sub;
          })(),
        );

        // Nómina obra: borradores del residente
        tasks.push(
          (async () => {
            if (!isResidente) return;
            c["nomina"] = await safeCount("obra.nomina.res",
              supabase
                .from("obra_nominas")
                .select("id", { count: "exact", head: true })
                .eq("obra_id", obraId)
                .eq("estatus", "borrador"),
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
