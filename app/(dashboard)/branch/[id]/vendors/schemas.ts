import { z } from "zod";
import { VENDOR_PAYABLE_CATEGORIES } from "@/lib/finance/monthly-pnl";

const entityId = z.string().trim().min(1);

/** Accepts `YYYY-MM-DD` or ISO datetime; normalizes to calendar date. */
const isoDate = z.preprocess((v) => {
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const nonNegativeNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : v),
  z.coerce.number().min(0),
);

const positiveAmount = nonNegativeNumber.refine((n) => n > 0, {
  message: "Amount must be greater than zero",
});

export const uploadVendorReceiptSchema = z.object({
  branchId: entityId,
  vendorName: z.enum(VENDOR_PAYABLE_CATEGORIES),
  invoiceDate: isoDate,
  file: z.instanceof(File),
});

export const attachVendorReceiptSchema = uploadVendorReceiptSchema.extend({
  invoiceId: entityId,
});

export const addVendorInvoiceSchema = z.object({
  branchId: entityId,
  vendorName: z.enum(VENDOR_PAYABLE_CATEGORIES),
  invoiceDate: isoDate,
  amount: positiveAmount,
  receiptFile: z.instanceof(File).nullable().optional(),
});

export const updateVendorInvoiceSchema = z.object({
  branchId: entityId,
  invoiceId: entityId,
  vendorName: z.enum(VENDOR_PAYABLE_CATEGORIES),
  invoiceDate: isoDate,
  amount: positiveAmount,
});

export const deleteVendorInvoiceSchema = z.object({
  branchId: entityId,
  invoiceId: entityId,
});

export const vendorSmartAnalysisSchema = z.object({
  branchId: z.string().trim().min(1),
  period: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});
