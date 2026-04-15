'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  VENDOR_PAYABLE_CATEGORIES,
  isVendorPayableCategory,
  type VendorPayableCategory,
} from '@/lib/finance/monthly-pnl';
import { generateVendorSmartCommentary } from '@/lib/ai/financial-commentary';
import {
  periodKeyFromDateIso,
  syncVendorExpensesForPeriod,
} from '@/lib/finance/transaction-sync';

type ActionResult<T = undefined> = {
  success: boolean;
  error?: string;
  data?: T;
};

type AddVendorInvoiceInput = {
  branchId: string;
  vendorName: VendorPayableCategory;
  invoiceDate: string;
  amount: number;
  receiptFile?: File | null;
};

type DeleteVendorInvoiceInput = {
  branchId: string;
  invoiceId: string;
};

type UploadVendorReceiptInput = {
  branchId: string;
  vendorName: VendorPayableCategory;
  invoiceDate: string;
  file: File;
};

type AttachVendorReceiptInput = UploadVendorReceiptInput & {
  invoiceId: string;
};

type VendorSmartAnalysisInput = {
  branchId: string;
  period: string;
};

type SmartStatus = 'Under Budget' | 'Trend Rising' | 'Critical Increase';

type VendorBreakdownItem = {
  vendorName: VendorPayableCategory;
  total: number;
  sharePct: number;
  status: SmartStatus;
};

type VendorSmartAnalysisData = {
  insights: string[];
  concentrationVendor: VendorPayableCategory;
  concentrationPct: number;
  highestVolatilityVendor: VendorPayableCategory;
  volatilityScore: number;
  forecastLiability: number;
  totalCurrentMonthSpend: number;
  period: string;
  vendorBreakdown: VendorBreakdownItem[];
};

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function cleanFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isPeriodKey(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

function monthKeyFromDate(input: Date): string {
  return `${input.getFullYear()}-${String(input.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(period: string, delta: number): string {
  const d = new Date(`${period}-01T12:00:00`);
  d.setMonth(d.getMonth() + delta);
  return monthKeyFromDate(d);
}

function monthStartIso(period: string): string {
  return `${period}-01`;
}

function monthEndIso(period: string): string {
  const d = new Date(`${period}-01T12:00:00`);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return `${period}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthSequence(period: string, months: number): string[] {
  const sequence: string[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    sequence.push(addMonths(period, -i));
  }
  return sequence;
}

function getSmartStatus(current: number, previous: number): SmartStatus {
  if (previous <= 0) return current > 0 ? 'Trend Rising' : 'Under Budget';
  const changePct = ((current - previous) / previous) * 100;
  if (changePct >= 15) return 'Critical Increase';
  if (changePct > 0) return 'Trend Rising';
  return 'Under Budget';
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function linearForecast(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return Math.max(0, values[0]);

  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;
  const forecast = intercept + slope * n;
  return Math.max(0, forecast);
}

async function uploadVendorReceipt(
  input: UploadVendorReceiptInput,
): Promise<ActionResult<{ receiptUrl: string }>> {
  const supabase = await createClient();
  const safeVendor = input.vendorName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const safeName = cleanFileName(input.file.name);
  const objectPath = `vendor-invoices/${input.branchId}/${input.invoiceDate}/${safeVendor}-${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(objectPath, input.file, { upsert: false });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  const { data } = supabase.storage.from('receipts').getPublicUrl(objectPath);
  return { success: true, data: { receiptUrl: data.publicUrl } };
}

export async function uploadVendorInvoiceReceiptAction(
  input: UploadVendorReceiptInput,
): Promise<ActionResult<{ receiptUrl: string }>> {
  if (!input.branchId) return { success: false, error: 'Missing branch id.' };
  if (!isVendorPayableCategory(input.vendorName)) {
    return { success: false, error: 'Invalid vendor category.' };
  }
  if (!isIsoDate(input.invoiceDate)) {
    return { success: false, error: 'Invoice date must be in YYYY-MM-DD format.' };
  }
  if (!input.file) return { success: false, error: 'Receipt file is required.' };

  return uploadVendorReceipt(input);
}

export async function attachVendorInvoiceReceiptAction(
  input: AttachVendorReceiptInput,
): Promise<ActionResult<{ receiptUrl: string }>> {
  if (!input.invoiceId) return { success: false, error: 'Missing invoice id.' };
  const uploaded = await uploadVendorInvoiceReceiptAction(input);
  if (!uploaded.success) return uploaded;

  const receiptUrl = uploaded.data?.receiptUrl ?? null;
  if (!receiptUrl) return { success: false, error: 'Receipt URL was not generated.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('vendor_invoices')
    .update({ receipt_url: receiptUrl })
    .eq('id', input.invoiceId)
    .eq('branch_id', input.branchId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/branch/${input.branchId}/vendors`);
  revalidatePath(`/branch/${input.branchId}/financials`);
  return { success: true, data: { receiptUrl } };
}

export async function addVendorInvoiceAction(
  input: AddVendorInvoiceInput,
): Promise<ActionResult<{ id: string; receiptUrl: string | null }>> {
  if (!input.branchId) return { success: false, error: 'Missing branch id.' };
  if (!isVendorPayableCategory(input.vendorName)) {
    return { success: false, error: 'Invalid vendor category.' };
  }
  if (!isIsoDate(input.invoiceDate)) {
    return { success: false, error: 'Invoice date must be in YYYY-MM-DD format.' };
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: 'Amount must be greater than zero.' };
  }

  let receiptUrl: string | null = null;
  if (input.receiptFile) {
    const uploadResult = await uploadVendorReceipt({
      branchId: input.branchId,
      vendorName: input.vendorName,
      invoiceDate: input.invoiceDate,
      file: input.receiptFile,
    });
    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error ?? 'Receipt upload failed.' };
    }
    receiptUrl = uploadResult.data?.receiptUrl ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vendor_invoices')
    .insert({
      branch_id: input.branchId,
      vendor_name: input.vendorName,
      invoice_date: input.invoiceDate,
      amount: Number(amount.toFixed(2)),
      receipt_url: receiptUrl,
    })
    .select('id, receipt_url')
    .single();

  if (error) return { success: false, error: error.message };

  await syncVendorExpensesForPeriod(
    supabase,
    input.branchId,
    periodKeyFromDateIso(input.invoiceDate),
  );

  revalidatePath(`/branch/${input.branchId}/vendors`);
  revalidatePath(`/branch/${input.branchId}/financials`);
  return {
    success: true,
    data: {
      id: String(data.id),
      receiptUrl: data.receipt_url ? String(data.receipt_url) : null,
    },
  };
}

export async function deleteVendorInvoiceAction(
  input: DeleteVendorInvoiceInput,
): Promise<ActionResult> {
  if (!input.branchId) return { success: false, error: 'Missing branch id.' };
  if (!input.invoiceId) return { success: false, error: 'Missing invoice id.' };

  const supabase = await createClient();
  const { data: deletedInvoice, error } = await supabase
    .from('vendor_invoices')
    .delete()
    .select('invoice_date')
    .eq('id', input.invoiceId)
    .eq('branch_id', input.branchId)
    .single();

  if (error) return { success: false, error: error.message };

  if (deletedInvoice?.invoice_date) {
    await syncVendorExpensesForPeriod(
      supabase,
      input.branchId,
      periodKeyFromDateIso(String(deletedInvoice.invoice_date)),
    );
  }

  revalidatePath(`/branch/${input.branchId}/vendors`);
  revalidatePath(`/branch/${input.branchId}/financials`);
  return { success: true };
}

export async function getVendorSmartAnalysisAction(
  input: VendorSmartAnalysisInput,
): Promise<ActionResult<VendorSmartAnalysisData>> {
  if (!input.branchId) return { success: false, error: 'Missing branch id.' };
  if (!isPeriodKey(input.period)) return { success: false, error: 'Period must be in YYYY-MM format.' };

  const periods = monthSequence(input.period, 6);
  const startDate = monthStartIso(periods[0]);
  const endDate = monthEndIso(input.period);
  const previousPeriod = addMonths(input.period, -1);

  const supabase = await createClient();
  const [{ data: branch }, { data: invoiceRows, error }] = await Promise.all([
    supabase.from('branches').select('name').eq('id', input.branchId).single(),
    supabase
      .from('vendor_invoices')
      .select('vendor_name, amount, invoice_date')
      .eq('branch_id', input.branchId)
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate),
  ]);

  if (error) return { success: false, error: error.message };

  const byVendorPeriod = new Map<VendorPayableCategory, Map<string, number>>();
  for (const vendor of VENDOR_PAYABLE_CATEGORIES) {
    byVendorPeriod.set(vendor, new Map(periods.map((period) => [period, 0])));
  }

  for (const row of invoiceRows ?? []) {
    const vendorName = row.vendor_name as VendorPayableCategory;
    if (!isVendorPayableCategory(vendorName)) continue;
    const periodKey = String(row.invoice_date).slice(0, 7);
    if (!periods.includes(periodKey)) continue;
    const periodMap = byVendorPeriod.get(vendorName);
    if (!periodMap) continue;
    const nextValue = (periodMap.get(periodKey) ?? 0) + (Number(row.amount ?? 0) || 0);
    periodMap.set(periodKey, nextValue);
  }

  let highestVolatilityVendor: VendorPayableCategory = VENDOR_PAYABLE_CATEGORIES[0];
  let highestVolatilityScore = -1;
  for (const vendor of VENDOR_PAYABLE_CATEGORIES) {
    const periodMap = byVendorPeriod.get(vendor);
    if (!periodMap) continue;
    const trend = periods.map((period) => Number((periodMap.get(period) ?? 0).toFixed(2)));
    const mean = trend.reduce((sum, value) => sum + value, 0) / trend.length;
    const volatilityScore = mean > 0 ? stdDev(trend) / mean : 0;
    if (volatilityScore > highestVolatilityScore) {
      highestVolatilityScore = volatilityScore;
      highestVolatilityVendor = vendor;
    }
  }

  const vendorBreakdown: VendorBreakdownItem[] = VENDOR_PAYABLE_CATEGORIES.map((vendor) => {
    const periodMap = byVendorPeriod.get(vendor);
    const currentTotal = Number((periodMap?.get(input.period) ?? 0).toFixed(2));
    const previousTotal = Number((periodMap?.get(previousPeriod) ?? 0).toFixed(2));
    return {
      vendorName: vendor,
      total: currentTotal,
      sharePct: 0,
      status: getSmartStatus(currentTotal, previousTotal),
    };
  });

  const totalCurrentMonthSpend = vendorBreakdown.reduce((sum, item) => sum + item.total, 0);
  const sortedByTotal = [...vendorBreakdown].sort((a, b) => b.total - a.total);
  const concentrationVendor = sortedByTotal[0]?.vendorName ?? VENDOR_PAYABLE_CATEGORIES[0];
  const concentrationPct =
    totalCurrentMonthSpend > 0 ? (sortedByTotal[0].total / totalCurrentMonthSpend) * 100 : 0;

  const normalizedBreakdown = vendorBreakdown
    .map((item) => ({
      ...item,
      sharePct: totalCurrentMonthSpend > 0 ? Number(((item.total / totalCurrentMonthSpend) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const monthlyTotals = periods.map((period) =>
    VENDOR_PAYABLE_CATEGORIES.reduce((sum, vendor) => {
      const periodMap = byVendorPeriod.get(vendor);
      return sum + (periodMap?.get(period) ?? 0);
    }, 0),
  );
  const forecastLiability = Number(linearForecast(monthlyTotals).toFixed(2));

  const insights = await generateVendorSmartCommentary({
    period: input.period,
    branchName: String(branch?.name ?? ''),
    context: {
      highestVolatilityVendor,
      volatilityScore: Number(highestVolatilityScore.toFixed(3)),
      concentrationVendor,
      concentrationPct: Number(concentrationPct.toFixed(2)),
      forecastLiability,
      totalCurrentMonthSpend: Number(totalCurrentMonthSpend.toFixed(2)),
      monthlyTotals: periods.map((period, idx) => ({
        period,
        total: Number(monthlyTotals[idx].toFixed(2)),
      })),
      vendorBreakdown: normalizedBreakdown,
      note: 'Price volatility is estimated using invoice spend trend because unit price fields are not present in vendor_invoices.',
    },
  });

  return {
    success: true,
    data: {
      insights,
      concentrationVendor,
      concentrationPct: Number(concentrationPct.toFixed(2)),
      highestVolatilityVendor,
      volatilityScore: Number(Math.max(0, highestVolatilityScore).toFixed(3)),
      forecastLiability,
      totalCurrentMonthSpend: Number(totalCurrentMonthSpend.toFixed(2)),
      period: input.period,
      vendorBreakdown: normalizedBreakdown,
    },
  };
}
