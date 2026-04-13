'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

function isBlockedVendorName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return (
    normalized === 'ahmed' ||
    normalized === 'أحمد' ||
    normalized === 'احمد'
  );
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
