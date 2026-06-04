import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PDFData {
  sc: any;
  company: any;
  requisicion: any;
  solicitante: any;
  residente?: any;
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("es-MX") : "—";


const mxn = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export function generarPDFSolicitudCotizacion(data: PDFData) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = M;

  // Header empresa
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text(data.company?.razon_social ?? "—", M, y);
  y += 16;
  doc.setFont("helvetica", "normal").setFontSize(9);
  if (data.company?.rfc) {
    doc.text(`RFC: ${data.company.rfc}`, M, y);
    y += 12;
  }
  const fact = data.company?.datos_facturacion ?? {};
  if (fact.direccion) {
    doc.text(String(fact.direccion), M, y, { maxWidth: W - M * 2 });
    y += 12;
  }

  // Título
  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text("SOLICITUD DE COTIZACIÓN", W / 2, y + 14, { align: "center" });
  y += 24;
  doc.setFont("helvetica", "normal").setFontSize(11);
  doc.text(`Folio: ${data.sc.folio}`, W - M, y, { align: "right" });
  y += 14;
  doc.text(
    `Fecha: ${new Date(data.sc.created_at).toLocaleDateString("es-MX")}`,
    W - M,
    y,
    { align: "right" }
  );
  y += 20;

  // Proveedor
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("PROVEEDOR", M, y);
  y += 14;
  doc.setFont("helvetica", "normal").setFontSize(10);
  const p = data.sc.proveedor ?? {};
  doc.text(`${p.razon_social ?? "—"}${p.rfc ? `  ·  RFC: ${p.rfc}` : ""}`, M, y);
  y += 12;
  if (p.contacto_nombre) {
    doc.text(`Atención: ${p.contacto_nombre}`, M, y);
    y += 12;
  }
  const contactos = [p.correo, p.telefono].filter(Boolean).join("  ·  ");
  if (contactos) {
    doc.text(contactos, M, y);
    y += 12;
  }
  y += 6;

  // Obra / requisición
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("REFERENCIA", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.text(`Requisición: ${data.requisicion?.folio ?? "—"}`, M, y);
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.text(`Obra: ${data.requisicion?.obra?.nombre ?? "—"}`, M, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  if (data.requisicion?.obra?.ubicacion) {
    const ubic = data.requisicion.obra.ubicacion as string;
    const isLink = /^https?:\/\//i.test(ubic.trim());
    const href = isLink
      ? ubic.trim()
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ubic.trim())}`;
    const labelText = isLink ? "Ver en Google Maps" : ubic;
    const prefix = "Ubicación: ";
    doc.text(prefix, M, y);
    const prefixWidth = doc.getTextWidth(prefix);
    doc.setTextColor(0, 0, 238);
    doc.textWithLink(labelText, M + prefixWidth, y, { url: href });
    const linkWidth = doc.getTextWidth(labelText);
    // subrayado
    doc.setDrawColor(0, 0, 238);
    doc.line(M + prefixWidth, y + 1, M + prefixWidth + linkWidth, y + 1);
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
    y += 12;
  }
  const resNombre = data.residente?.profile?.nombre_completo;
  if (resNombre) {
    const resCorreo = data.residente?.profile?.email;
    doc.text(
      `Residente de obra: ${resNombre}${resCorreo ? `  ·  ${resCorreo}` : ""}`,
      M, y
    );
    y += 12;
  }
  y += 8;

  // Tabla insumos
  const rows = (data.sc.items ?? []).map((it: any, i: number) => [
    i + 1,
    it.insumo?.nombre ?? "—",
    it.insumo?.unidad ?? "",
    Number(it.cantidad).toLocaleString("es-MX"),
    fmtDate(it.fecha_requerida),
    "",
    "",
    "",
  ]);
  autoTable(doc, {
    startY: y,
    head: [["#", "Descripción", "Unidad", "Cantidad", "F. requerida", "P. Unitario", "Importe", "T. entrega"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [15, 30, 61], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 22, halign: "center" },
      2: { cellWidth: 44, halign: "center" },
      3: { cellWidth: 52, halign: "right" },
      4: { cellWidth: 62, halign: "center" },
      5: { cellWidth: 60 },
      6: { cellWidth: 60 },
      7: { cellWidth: 60 },
    },
    margin: { left: M, right: M },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 20;
  doc.setFontSize(9).setFont("helvetica", "normal");
  doc.text("Favor de capturar precios, importe y tiempo de entrega por cada insumo.", M, finalY);
  doc.text(
    "Indicar vigencia de la cotización, condiciones de pago y forma de entrega.",
    M,
    finalY + 12
  );

  if (data.sc.notas) {
    const ny = finalY + 32;
    doc.setFont("helvetica", "bold");
    doc.text("Notas:", M, ny);
    doc.setFont("helvetica", "normal");
    doc.text(String(data.sc.notas), M, ny + 12, { maxWidth: W - M * 2 });
  }

  // Firma / contacto del solicitante
  const fy = doc.internal.pageSize.getHeight() - 80;
  doc.setDrawColor(120).line(M, fy, W / 2 - 20, fy);
  doc.setFontSize(9);
  doc.text(data.solicitante?.nombre_completo ?? "—", M, fy + 12);
  if (data.solicitante?.email) doc.text(data.solicitante.email, M, fy + 24);
  doc.text("Solicitante", M, fy + 36);

  doc.save(`${data.sc.folio}.pdf`);
}

export function calcularTotalSC(items: any[]): number {
  return items.reduce(
    (s, it) =>
      s + Number(it.cantidad) * Number(it.precio_unitario ?? 0),
    0
  );
}

export const formatMXN = mxn;
