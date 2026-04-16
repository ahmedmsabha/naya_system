import { z } from "zod";
import { VENDOR_PAYABLE_CATEGORIES } from "@/lib/finance/monthly-pnl";

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nonNegativeNumber = z.coerce.number().min(0);

export const uploadVendorReceiptSchema = z.object({
  branchId: uuid,
  vendorName: z.enum(VENDOR_PAYABLE_CATEGORIES),
  invoiceDate: isoDate,
  file: z.instanceof(File),
});

export const attachVendorReceiptSchema = uploadVendorReceiptSchema.extend({
  invoiceId: uuid,
});

export const addVendorInvoiceSchema = z.object({
  branchId: uuid,
  vendorName: z.enum(VENDOR_PAYABLE_CATEGORIES),
  invoiceDate: isoDate,
  amount: nonNegativeNumber.positive(),
  receiptFile: z.instanceof(File).nullable().optional(),
});

export const deleteVendorInvoiceSchema = z.object({
  branchId: uuid,
  invoiceId: uuid,
});

export const vendorSmartAnalysisSchema = z.object({
  // Some legacy branch routes may still use non-UUID identifiers.
  branchId: z.string().trim().min(1),
  period: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});
