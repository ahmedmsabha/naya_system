'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isVendorPayableCategory, type VendorPayableCategory } from '@/lib/finance/monthly-pnl';

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

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function cleanFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
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
  const { error } = await supabase
    .from('vendor_invoices')
    .delete()
    .eq('id', input.invoiceId)
    .eq('branch_id', input.branchId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/branch/${input.branchId}/vendors`);
  revalidatePath(`/branch/${input.branchId}/financials`);
  return { success: true };
}
