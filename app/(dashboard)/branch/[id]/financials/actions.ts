'use server';

import { createClient } from '@/lib/supabase/server';
import { authorize } from '@/lib/auth/authorize';
import { revalidatePath } from 'next/cache';
import {
  MONTHLY_PNL_DEDUCTION_CATEGORIES,
  type MonthlyPnLDeductionCategory,
  type MonthlyPnLExpenseCategory,
  isMonthlyPnLCategory,
} from '@/lib/finance/monthly-pnl';
import {
  deleteSupplierFormSchema,
  safeParseFinancialsForm,
  supplierFormSchema,
  upsertDeductionsSchema,
  upsertExpenseSchema,
} from './schemas';

function isBlockedVendorName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === 'ahmed';
}

export async function addSuppliersAction(formData: FormData) {
  const parsedForm = safeParseFinancialsForm(supplierFormSchema, formData);
  if (!parsedForm.success) return { success: false, error: 'Invalid supplier payload.' };

  const branchId = parsedForm.data.branch_id;
  const singleVendor = parsedForm.data.vendor_name.trim();
  const rawNames = parsedForm.data.vendor_names;

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

  if (!branchId || candidates.length === 0) return { success: false, error: 'No suppliers to add.' };
  const access = await authorize({ module: 'financials', action: 'edit', branchId });
  if (!access.ok) return { success: false, error: access.reason ?? 'Unauthorized' };

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
  return { success: true };
}

export async function deleteSupplierAction(formData: FormData) {
  const parsedForm = safeParseFinancialsForm(deleteSupplierFormSchema, formData);
  if (!parsedForm.success) return { success: false, error: 'Invalid supplier delete payload.' };

  const branchId = parsedForm.data.branch_id;
  const supplierId = parsedForm.data.supplier_id;
  const access = await authorize({ module: 'financials', action: 'edit', branchId });
  if (!access.ok) return { success: false, error: access.reason ?? 'Unauthorized' };

  const supabase = await createClient();
  await supabase.from('suppliers').delete().eq('id', supplierId);

  revalidatePath(`/branch/${branchId}/financials`);
  return { success: true };
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
  const parsedInput = upsertExpenseSchema.safeParse(input);
  if (!parsedInput.success) {
    return { success: false, error: 'Invalid expense payload.' };
  }

  if (!validateMonthPeriod(parsedInput.data.monthPeriod)) {
    return { success: false, error: 'Month period must be in YYYY-MM format.' };
  }
  if (!isMonthlyPnLCategory(parsedInput.data.category)) {
    return { success: false, error: 'Invalid expense category.' };
  }
  const access = await authorize({
    module: 'financials',
    action: 'edit',
    branchId: parsedInput.data.branchId,
  });
  if (!access.ok) return { success: false, error: access.reason ?? 'Unauthorized' };

  const amount = Number(parsedInput.data.amount);

  const supabase = await createClient();
  let receiptUrl: string | undefined;

  if (parsedInput.data.file) {
    const uploaded = await uploadReceiptToStorage(
      supabase,
      parsedInput.data.branchId,
      parsedInput.data.monthPeriod,
      parsedInput.data.category,
      parsedInput.data.file,
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
    branch_id: parsedInput.data.branchId,
    month_period: parsedInput.data.monthPeriod,
    category: parsedInput.data.category,
    amount: Number(amount.toFixed(2)),
  };

  if (receiptUrl) payload.receipt_url = receiptUrl;

  const { error } = await supabase
    .from('branch_monthly_expenses')
    .upsert(payload, { onConflict: 'branch_id,month_period,category' });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/branch/${parsedInput.data.branchId}/financials`);
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
  const parsedInput = upsertDeductionsSchema.safeParse(input);
  if (!parsedInput.success) return { success: false, error: 'Invalid deductions payload.' };
  if (!validateMonthPeriod(parsedInput.data.monthPeriod)) {
    return { success: false, error: 'Month period must be in YYYY-MM format.' };
  }
  const access = await authorize({
    module: 'financials',
    action: 'edit',
    branchId: parsedInput.data.branchId,
  });
  if (!access.ok) return { success: false, error: access.reason ?? 'Unauthorized' };

  const rows = MONTHLY_PNL_DEDUCTION_CATEGORIES.map((category) => {
    const amount = Number(parsedInput.data.values[category] ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Invalid amount for ${category}.`);
    }
    return {
      branch_id: parsedInput.data.branchId,
      month_period: parsedInput.data.monthPeriod,
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

    revalidatePath(`/branch/${parsedInput.data.branchId}/financials`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save deductions.',
    };
  }
}

