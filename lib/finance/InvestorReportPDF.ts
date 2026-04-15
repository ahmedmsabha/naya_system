import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type InvestorMetricRow = {
  label: string;
  value: string;
};

type InvestorReportInput = {
  branchName: string;
  monthLabel: string;
  generatedAt?: Date;
  projectedValuation: number;
  projectedProfit: number;
  projectedRoi: number;
  retentionIndex: number;
  metrics: InvestorMetricRow[];
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function exportInvestorReportPDF(input: InvestorReportInput): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const generatedAt = input.generatedAt ?? new Date();
  const generatedLabel = generatedAt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  doc.setFontSize(19);
  doc.text('Investor Intelligence Brief', 40, 52);

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Branch: ${input.branchName}`, 40, 74);
  doc.text(`Period: ${input.monthLabel}`, 40, 90);
  doc.text(`Generated: ${generatedLabel}`, 40, 106);

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Core Investor Signals', 40, 138);

  autoTable(doc, {
    startY: 150,
    head: [['Metric', 'Value']],
    body: [
      ['Projected Valuation', formatCurrency(input.projectedValuation)],
      ['Projected Net Profit', formatCurrency(input.projectedProfit)],
      ['Projected ROI', formatPercent(input.projectedRoi)],
      ['Investor Retention Index', formatPercent(input.retentionIndex)],
      ...input.metrics.map((row) => [row.label, row.value]),
    ],
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

  const safeBranch = input.branchName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const safeMonth = input.monthLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  doc.save(`investor-brief-${safeBranch}-${safeMonth}.pdf`);
}
