import type jsPDF from "jspdf";

type HeaderMeta = {
  title: string;
  subtitle: string;
  rightMeta?: string[];
};

export function applyBlueHeaderTemplate(doc: jsPDF, meta: HeaderMeta): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, pageWidth, 96, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(meta.title, 40, 44);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(meta.subtitle, 40, 66);

  if (meta.rightMeta && meta.rightMeta.length > 0) {
    let y = 32;
    for (const line of meta.rightMeta.slice(0, 4)) {
      doc.text(line, pageWidth - 40, y, { align: "right" });
      y += 14;
    }
  }

  doc.setDrawColor(191, 219, 254);
  doc.setLineWidth(1.2);
  doc.line(40, 102, pageWidth - 40, 102);

  doc.setTextColor(17, 24, 39);
  return 122;
}

