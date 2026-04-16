import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { applyBlueHeaderTemplate } from '@/lib/finance/pdf-template';

type SmartStatus = 'Under Budget' | 'Trend Rising' | 'Critical Increase';

type VendorReportRow = {
  vendorName: string;
  total: number;
  sharePct: number;
  status: SmartStatus;
};

type VendorReportInput = {
  branchName: string;
  monthLabel: string;
  generatedAt?: Date;
  insights: string[];
  rows: VendorReportRow[];
  totalSpend: number;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function exportVendorReportPDF(input: VendorReportInput): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const now = input.generatedAt ?? new Date();
  const timestamp = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const contentStartY = applyBlueHeaderTemplate(doc, {
    title: 'Executive Vendor Spend Report',
    subtitle: `${input.branchName} - ${input.monthLabel}`,
    rightMeta: [
      `Generated: ${timestamp}`,
      `Total Spend: ${formatCurrency(input.totalSpend)}`,
    ],
  });

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Executive Summary (AI Insights)', 40, contentStartY);

  const insights =
    input.insights.length > 0
      ? input.insights
      : ['No AI insights available for this period. Add invoice activity and regenerate the smart report.'];

  let y = contentStartY + 20;
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  for (const insight of insights.slice(0, 3)) {
    const wrapped = doc.splitTextToSize(`- ${insight}`, 515);
    doc.text(wrapped, 40, y);
    y += 18 + (wrapped.length - 1) * 10;
  }

  autoTable(doc, {
    startY: y + 14,
    head: [['Vendor', 'Total Spend', 'Share %', 'Smart Status']],
    body:
      input.rows.length > 0
        ? input.rows.map((row) => [
            row.vendorName,
            formatCurrency(row.total),
            formatPercent(row.sharePct),
            row.status,
          ])
        : [['No vendor invoices found for this period', '-', '-', '-']],
    styles: {
      fontSize: 10,
      cellPadding: 8,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.5,
  });

  doc.save(`vendor-report-${input.branchName}-${input.monthLabel}.pdf`.replace(/\s+/g, '-').toLowerCase());
}
