"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { applyBlueHeaderTemplate } from "@/lib/finance/pdf-template";

type WeeklyPdfRow = {
  item: string;
  unitPrice: number;
  dailyQty: [number, number, number, number, number, number, number];
  totalQty: number;
  totalPrice: number;
};

export type WeeklyInvoicePdfInput = {
  branchName: string;
  invoiceNumber: string;
  weekStartLabel: string;
  weekEndLabel: string;
  rows: WeeklyPdfRow[];
  grandTotal: number;
};

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function generateWeeklyInvoicePdf(input: WeeklyInvoicePdfInput) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const contentStartY = applyBlueHeaderTemplate(doc, {
    title: "Weekly Warehouse Invoice",
    subtitle: `${input.branchName} - ${input.weekStartLabel} to ${input.weekEndLabel}`,
    rightMeta: [
      `Invoice #: ${input.invoiceNumber}`,
      `Grand Total: ${money(input.grandTotal)}`,
    ],
  });

  const body = input.rows.map((row) => [
    row.item,
    money(row.unitPrice),
    row.dailyQty[0] || 0,
    row.dailyQty[1] || 0,
    row.dailyQty[2] || 0,
    row.dailyQty[3] || 0,
    row.dailyQty[4] || 0,
    row.dailyQty[5] || 0,
    row.dailyQty[6] || 0,
    row.totalQty,
    money(row.totalPrice),
  ]);

  autoTable(doc, {
    theme: "grid",
    startY: contentStartY,
    head: [["Item", "Unit Price", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Total Qty", "Total Price"]],
    body,
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 5,
      lineColor: [220, 224, 229],
      lineWidth: 0.6,
      textColor: [17, 24, 39],
    },
    headStyles: {
      fillColor: [238, 242, 255],
      textColor: [30, 58, 138],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 210 },
      1: { halign: "right", cellWidth: 78 },
      2: { halign: "center", cellWidth: 52 },
      3: { halign: "center", cellWidth: 52 },
      4: { halign: "center", cellWidth: 52 },
      5: { halign: "center", cellWidth: 52 },
      6: { halign: "center", cellWidth: 52 },
      7: { halign: "center", cellWidth: 52 },
      8: { halign: "center", cellWidth: 52 },
      9: { halign: "right", cellWidth: 70 },
      10: { halign: "right", cellWidth: 84 },
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 132;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Grand Total: ${money(input.grandTotal)}`, pageWidth - 40, finalY + 28, { align: "right" });

  const safeBranch = input.branchName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  doc.save(`invoice-${safeBranch}-${input.invoiceNumber}.pdf`);
}
