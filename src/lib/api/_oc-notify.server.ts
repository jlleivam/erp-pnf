// Server-only helper to notify Supervisores of an obra when a Residente
// submits an Orden de Cambio (o un destajo nuevo) para autorización.

type TipoSolicitud =
  | "oc_presupuesto_solicitada"
  | "oc_destajo_solicitada"
  | "oc_subcontrato_solicitada"
  | "destajo_solicitado";

const TIPO_LABEL: Record<TipoSolicitud, string> = {
  oc_presupuesto_solicitada: "presupuesto",
  oc_destajo_solicitada: "destajo",
  oc_subcontrato_solicitada: "subcontrato",
  destajo_solicitado: "destajo",
};

export async function notifySupervisoresOC(
  supabase: any,
  args: {
    userId: string;
    obraId: string;
    tipo: TipoSolicitud;
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
  const esDestajoBase = tipo === "destajo_solicitado";
  const titulo = esDestajoBase ? "Nuevo destajo por autorizar" : "Nueva OC por autorizar";
  const mensaje = esDestajoBase
    ? `${quien} autorización de un ${label}${donde}.`
    : `${quien} autorización de una OC de ${label}${donde}.`;

  const rows = destinatarios.map((uid) => ({
    user_id: uid,
    company_id: obra.company_id as string,
    obra_id: obraId,
    tipo,
    titulo,
    mensaje,
    link,
  }));

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("notificaciones").insert(rows);
  if (error) console.error("[notificaciones] insert failed", error.message);
}

type TipoRespuesta =
  | "oc_presupuesto_autorizada"
  | "oc_destajo_autorizada"
  | "oc_subcontrato_autorizada"
  | "oc_presupuesto_rechazada"
  | "oc_destajo_rechazada"
  | "oc_subcontrato_rechazada"
  | "destajo_autorizado"
  | "destajo_rechazado";

const TIPO_LABEL_RES: Record<TipoRespuesta, string> = {
  oc_presupuesto_autorizada: "presupuesto",
  oc_destajo_autorizada: "destajo",
  oc_subcontrato_autorizada: "subcontrato",
  oc_presupuesto_rechazada: "presupuesto",
  oc_destajo_rechazada: "destajo",
  oc_subcontrato_rechazada: "subcontrato",
  destajo_autorizado: "destajo",
  destajo_rechazado: "destajo",
};

export async function notifyResidenteOC(
  supabase: any,
  args: {
    residenteId: string | null | undefined;
    actorUserId: string;
    obraId: string;
    tipo: TipoRespuesta;
    link: string;
    motivo?: string | null;
  },
) {
  const { residenteId, actorUserId, obraId, tipo, link, motivo } = args;
  if (!residenteId || residenteId === actorUserId) return;

  const [{ data: obra }, { data: actor }] = await Promise.all([
    supabase.from("obras").select("nombre, company_id").eq("id", obraId).maybeSingle(),
    supabase.from("profiles").select("nombre_completo").eq("id", actorUserId).maybeSingle(),
  ]);
  if (!obra?.company_id) return;

  const esAutorizada = tipo.endsWith("autorizada") || tipo === "destajo_autorizado";
  const esDestajoBase = tipo === "destajo_autorizado" || tipo === "destajo_rechazado";
  const accion = esAutorizada ? "autorizó" : "rechazó";
  const quien = actor?.nombre_completo ?? "El supervisor";
  const donde = obra?.nombre ? ` en la obra ${obra.nombre}` : "";
  const label = TIPO_LABEL_RES[tipo] ?? "OC";
  const sufMotivo = !esAutorizada && motivo ? ` Motivo: ${motivo}` : "";

  const titulo = esDestajoBase
    ? esAutorizada
      ? "Destajo autorizado"
      : "Destajo rechazado"
    : esAutorizada
      ? "OC autorizada"
      : "OC rechazada";
  const mensaje = esDestajoBase
    ? `${quien} ${accion} tu ${label}${donde}.${sufMotivo}`
    : `${quien} ${accion} tu OC de ${label}${donde}.${sufMotivo}`;

  const row = {
    user_id: residenteId,
    company_id: obra.company_id as string,
    obra_id: obraId,
    tipo,
    titulo,
    mensaje,
    link,
  };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("notificaciones").insert(row);
  if (error) console.error("[notificaciones] insert failed", error.message);
}
