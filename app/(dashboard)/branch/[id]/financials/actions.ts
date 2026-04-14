'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  MONTHLY_PNL_DEDUCTION_CATEGORIES,
  type MonthlyPnLDeductionCategory,
  type MonthlyPnLExpenseCategory,
  isMonthlyPnLCategory,
} from '@/lib/finance/monthly-pnl';

function isBlockedVendorName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === 'ahmed';
}

export async function addSuppliersAction(formData: FormData) {
  const branchId = String(formData.get('branch_id') ?? '');
  const singleVendor = String(formData.get('vendor_name') ?? '').trim();
  const rawNames = String(formData.get('vendor_names') ?? '[]');

  const parsedNames: string[] = (() => {
    try {
      const values = JSON.parse(rawNames);
      return Array.isArray(values)
        ? values.map((v) => String(v ?? '').trim()).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  })();

  const candidates = [singleVendor, ...parsedNames]
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .filter((name) => !isBlockedVendorName(name));

  if (!branchId || candidates.length === 0) return;

  const supabase = await createClient();
  const { data: existingRows } = await supabase
    .from('suppliers')
    .select('name');

  const existing = new Set(
    (existingRows ?? []).map((row) =>
      String(row.name ?? '').trim().toLowerCase(),
    ),
  );

  const toInsert = Array.from(new Set(candidates)).filter(
    (name) => !existing.has(name.toLowerCase()),
  );

  if (toInsert.length > 0) {
    await supabase
      .from('suppliers')
      .insert(toInsert.map((name) => ({ name })));
  }

  revalidatePath(`/branch/${branchId}/financials`);
}

export async function deleteSupplierAction(formData: FormData) {
  const branchId = String(formData.get('branch_id') ?? '');
  const supplierId = String(formData.get('supplier_id') ?? '');
  if (!branchId || !supplierId) return;

  const supabase = await createClient();
  await supabase.from('suppliers').delete().eq('id', supplierId);

  revalidatePath(`/branch/${branchId}/financials`);
}

type UpsertExpenseInput = {
  branchId: string;
  monthPeriod: string;
  category: MonthlyPnLExpenseCategory | MonthlyPnLDeductionCategory;
  amount: number;
  file?: File | null;
};

type UpsertExpenseResult = {
  success: boolean;
  error?: string;
  receiptUrl?: string | null;
};

function validateMonthPeriod(monthPeriod: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(monthPeriod);
}

async function uploadReceiptToStorage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchId: string,
  monthPeriod: string,
  category: string,
  file: File,
): Promise<{ receiptUrl?: string; error?: string }> {
  const safeCategory = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectPath = `branch-expenses/${branchId}/${monthPeriod}/${safeCategory}-${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(objectPath, file, { upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data } = supabase.storage.from('receipts').getPublicUrl(objectPath);
  return { receiptUrl: data.publicUrl };
}

export async function upsertExpense(input: UpsertExpenseInput): Promise<UpsertExpenseResult> {
  if (!input.branchId) return { success: false, error: 'Missing branch id.' };
  if (!validateMonthPeriod(input.monthPeriod)) {
    return { success: false, error: 'Month period must be in YYYY-MM format.' };
  }
  if (!isMonthlyPnLCategory(input.category)) {
    return { success: false, error: 'Invalid expense category.' };
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { success: false, error: 'Amount must be a non-negative number.' };
  }

  const supabase = await createClient();
  let receiptUrl: string | undefined;

  if (input.file) {
    const uploaded = await uploadReceiptToStorage(
      supabase,
      input.branchId,
      input.monthPeriod,
      input.category,
      input.file,
    );
    if (uploaded.error) return { success: false, error: uploaded.error };
    receiptUrl = uploaded.receiptUrl;
  }

  const payload: {
    branch_id: string;
    month_period: string;
    category: string;
    amount: number;
    receipt_url?: string;
  } = {
    branch_id: input.branchId,
    month_period: input.monthPeriod,
    category: input.category,
    amount: Number(amount.toFixed(2)),
  };

  if (receiptUrl) payload.receipt_url = receiptUrl;

  const { error } = await supabase
    .from('branch_monthly_expenses')
    .upsert(payload, { onConflict: 'branch_id,month_period,category' });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/branch/${input.branchId}/financials`);
  return { success: true, receiptUrl: receiptUrl ?? null };
}

type UpsertDeductionsInput = {
  branchId: string;
  monthPeriod: string;
  values: Record<MonthlyPnLDeductionCategory, number>;
};

export async function upsertDeductions(
  input: UpsertDeductionsInput,
): Promise<{ success: boolean; error?: string }> {
  if (!input.branchId) return { success: false, error: 'Missing branch id.' };
  if (!validateMonthPeriod(input.monthPeriod)) {
    return { success: false, error: 'Month period must be in YYYY-MM format.' };
  }

  const rows = MONTHLY_PNL_DEDUCTION_CATEGORIES.map((category) => {
    const amount = Number(input.values[category] ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Invalid amount for ${category}.`);
    }
    return {
      branch_id: input.branchId,
      month_period: input.monthPeriod,
      category,
      amount: Number(amount.toFixed(2)),
    };
  });

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('branch_monthly_expenses')
      .upsert(rows, { onConflict: 'branch_id,month_period,category' });

    if (error) return { success: false, error: error.message };

    revalidatePath(`/branch/${input.branchId}/financials`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save deductions.',
    };
  }
}

