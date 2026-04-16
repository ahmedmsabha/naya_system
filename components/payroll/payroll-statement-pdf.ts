'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { applyBlueHeaderTemplate } from '@/lib/finance/pdf-template';

export type PayrollStatementPdfRow = {
  employee: string;
  baseSalary: number;
  paidAmount: number;
  status: string;
};

export type PayrollStatementPdfInput = {
  branchName: string;
  periodLabel: string;
  rows: PayrollStatementPdfRow[];
  totalPayroll: number;
  paidSoFar: number;
  remaining: number;
};

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

function sanitizeFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generatePayrollStatementPdf(
  input: PayrollStatementPdfInput,
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const contentStartY = applyBlueHeaderTemplate(doc, {
    title: 'Salary Payment Statement',
    subtitle: `${input.branchName} - ${input.periodLabel}`,
    rightMeta: [
      `Total Payroll: ${money(input.totalPayroll)}`,
      `Paid: ${money(input.paidSoFar)}`,
      `Remaining: ${money(input.remaining)}`,
    ],
  });

  const body = input.rows.map((row) => [
    row.employee,
    money(row.baseSalary),
    money(row.paidAmount),
    row.status,
  ]);

  autoTable(doc, {
    theme: 'grid',
    startY: contentStartY,
    head: [['Employee', 'Base Salary', 'Paid Amount', 'Status']],
    body,
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 6,
      lineColor: [220, 224, 229],
      lineWidth: 0.6,
      textColor: [17, 24, 39],
    },
    headStyles: {
      fillColor: [238, 242, 255],
      textColor: [30, 58, 138],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 220 },
      1: { halign: 'right', cellWidth: 110 },
      2: { halign: 'right', cellWidth: 110 },
      3: { halign: 'left', cellWidth: 120 },
    },
  });

  const finalY =
    (
      doc as jsPDF & {
        lastAutoTable?: { finalY: number };
      }
    ).lastAutoTable?.finalY ?? 124;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Total Payroll: ${money(input.totalPayroll)}`, pageWidth - 40, finalY + 28, {
    align: 'right',
  });
  doc.text(`Paid So Far: ${money(input.paidSoFar)}`, pageWidth - 40, finalY + 46, {
    align: 'right',
  });
  doc.text(`Remaining: ${money(input.remaining)}`, pageWidth - 40, finalY + 64, {
    align: 'right',
  });

  const safeBranch = sanitizeFilename(input.branchName);
  const safePeriod = sanitizeFilename(input.periodLabel);
  doc.save(`payroll-statement-${safeBranch}-${safePeriod}.pdf`);
}
