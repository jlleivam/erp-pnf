// Server-only helper to notify Supervisores of an obra when a Residente
// submits an Orden de Cambio for authorization.

const TIPO_LABEL: Record<string, string> = {
  oc_presupuesto_solicitada: "presupuesto",
  oc_destajo_solicitada: "destajo",
  oc_subcontrato_solicitada: "subcontrato",
};

export async function notifySupervisoresOC(
  supabase: any,
  args: {
    userId: string;
    obraId: string;
    tipo: "oc_presupuesto_solicitada" | "oc_destajo_solicitada" | "oc_subcontrato_solicitada";
    link: string;
  },
) {
  const { userId, obraId, tipo, link } = args;

  // Supervisores de la obra (excluyendo al solicitante)
  const { data: team } = await supabase
    .from("obra_team")
    .select("user_id")
    .eq("obra_id", obraId)
    .eq("role", "supervisor");
  const destinatarios = Array.from(
    new Set(
      ((team ?? []) as Array<{ user_id: string }>)
        .map((t) => t.user_id)
        .filter((u) => u && u !== userId),
    ),
  );
  if (destinatarios.length === 0) return;

  const [{ data: obra }, { data: solicitante }] = await Promise.all([
    supabase.from("obras").select("nombre, company_id").eq("id", obraId).maybeSingle(),
    supabase.from("profiles").select("nombre_completo").eq("id", userId).maybeSingle(),
  ]);
  if (!obra?.company_id) return;

  const quien = solicitante?.nombre_completo
    ? `${solicitante.nombre_completo} solicitó`
    : "Se solicitó";
  const donde = obra?.nombre ? ` en la obra ${obra.nombre}` : "";
  const label = TIPO_LABEL[tipo] ?? "OC";

  const rows = destinatarios.map((uid) => ({
    user_id: uid,
    company_id: obra.company_id as string,
    obra_id: obraId,
    tipo,
    titulo: "Nueva OC por autorizar",
    mensaje: `${quien} autorización de una OC de ${label}${donde}.`,
    link,
  }));

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("notificaciones").insert(rows);
  if (error) console.error("[notificaciones] insert failed", error.message);
}
