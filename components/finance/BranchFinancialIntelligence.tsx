'use client';

import { useMemo, useState } from 'react';
import {
  Bot,
  Camera,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { formatNumberEn } from '@/lib/format/en';
import {
  addSuppliersAction,
  deleteSupplierAction,
} from '@/app/(dashboard)/branch/[id]/financials/actions';

type InsightItem = {
  id: string;
  text: string;
};

type SpendTile = {
  id: string;
  label: string;
  amount: number;
};

export function BranchFinancialIntelligence({
  branchId,
  branchName,
  monthLabel,
  selectedPeriod,
  monthHrefPrev,
  monthHrefNext,
  varianceHref,
  insights,
  metricCards,
  topSpendTiles,
  invoiceVendors,
  vendorCostRows,
  suppliers,
  netProfit,
  marginPct,
}: {
  branchId: string;
  branchName: string;
  monthLabel: string;
  selectedPeriod: string;
  monthHrefPrev: string;
  monthHrefNext: string;
  varianceHref: string;
  insights: InsightItem[];
  metricCards: Array<{ label: string; value: number }>;
  topSpendTiles: SpendTile[];
  invoiceVendors: string[];
  vendorCostRows: Array<{
    id: string;
    name: string;
    total: number;
  }>;
  suppliers: Array<{ id: string; name: string }>;
  netProfit: number;
  marginPct: number;
}) {
  const [draftAmount, setDraftAmount] = useState('');
  const [watchlistInput, setWatchlistInput] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [
    dismissedInvoiceVendors,
    setDismissedInvoiceVendors,
  ] = useState<string[]>([]);

  const ringDeg = useMemo(
    () =>
      Math.max(0, Math.min(360, (marginPct / 100) * 360)),
    [marginPct],
  );
  const visibleInvoiceVendors = invoiceVendors.filter(
    (name) => !dismissedInvoiceVendors.includes(name),
  );
  const invoiceVendorOptions = Array.from(
    new Set([
      ...suppliers.map((supplier) => supplier.name),
      ...invoiceVendors,
    ]),
  )
    .map((name) => name.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const addSupplierFormAction = async (formData: FormData): Promise<void> => {
    await addSuppliersAction(formData);
  };

  const deleteSupplierFormAction = async (formData: FormData): Promise<void> => {
    await deleteSupplierAction(formData);
  };

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center rounded-2xl bg-gray-100 p-1">
          <a
            href={monthHrefPrev}
            className="px-5 py-2 rounded-xl text-sm font-black text-gray-500 hover:text-gray-800"
          >
            Previous Month
          </a>
          <div className="px-5 py-2 rounded-xl text-sm font-black bg-[#2563eb] text-white min-w-[170px] text-center shadow-sm">
            {monthLabel}
          </div>
          <a
            href={monthHrefNext}
            className="px-5 py-2 rounded-xl text-sm font-black text-gray-500 hover:text-gray-800"
          >
            Next Month
          </a>
        </div>

        <div className="text-left">
          <div className="text-3xl md:text-4xl font-black tracking-wide text-[#052e36]">
            G-TOWN INTELLIGENCE
          </div>
          <div className="text-xs font-bold text-gray-500 mt-1">
            Branch financial analytics and executive
            monitoring
          </div>
          <div className="text-xs font-bold text-gray-500 mt-1">
            {branchName} - {selectedPeriod}
          </div>
          <a
            href={varianceHref}
            className="mt-2 inline-flex items-center rounded-full bg-[#052e36] text-white px-3 py-3 text-[10px] font-black tracking-widest uppercase"
          >
            Open Variance Intelligence
          </a>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-lg font-black text-[#052e36]">
            <Bot className="w-5 h-5 text-[#2563eb]" />
            AI Executive Insights
          </div>
          <span className="text-[11px] font-bold text-gray-400">
            Generated from operational branch expenses
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {insights.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-gray-100 bg-[#f8fafc] px-4 py-3 text-sm font-bold text-[#052e36]"
            >
              {item.text}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {metricCards.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm"
          >
            <div className="text-[10px] uppercase tracking-widest font-black text-gray-400">
              {metric.label}
            </div>
            <div className="text-2xl font-black mt-1 text-[#052e36]">
              ${formatNumberEn(metric.value)}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-[1.75rem] border border-gray-100 bg-white p-5 shadow-sm flex items-center justify-between">
          <div className="inline-flex items-center gap-3">
            <div
              className="w-20 h-20 rounded-full"
              style={{
                background: `conic-gradient(#3b82f6 ${ringDeg}deg, #e5e7eb ${ringDeg}deg 360deg)`,
              }}
            >
              <div className="w-full h-full rounded-full p-3">
                <div className="w-full h-full rounded-full bg-white" />
              </div>
            </div>
            <div>
              <div className="text-sm font-black text-[#10b981]">
                Net margin performance
              </div>
              <div className="text-4xl font-black mt-2 text-[#052e36]">
                ${formatNumberEn(netProfit)}
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-[#ecfdf5] text-[#10b981] px-4 py-2 text-sm font-black inline-flex items-center gap-2 border border-[#a7f3d0]">
            <Sparkles className="w-4 h-4" />
            MARGIN: {formatNumberEn(marginPct)}%
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-gray-100 bg-white p-5 shadow-sm">
          <div className="text-sm font-black text-[#052e36]">
            Add Invoice (Quick)
          </div>
          <div className="mt-3 space-y-2">
            <input
              value={draftAmount}
              onChange={(e) =>
                setDraftAmount(e.target.value)
              }
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount ($)"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#052e36] focus:outline-none focus:border-[#2563eb]"
            />
            <select
              value={selectedVendor}
              onChange={(e) =>
                setSelectedVendor(e.target.value)
              }
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#052e36] focus:outline-none focus:border-[#2563eb]"
            >
              <option value="">Select vendor...</option>
              {invoiceVendorOptions.map((vendor) => (
                <option key={vendor} value={vendor}>
                  {vendor}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-xl bg-[#3b82f6] text-white px-3 py-2 text-sm font-black inline-flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Scan Invoice
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    !selectedVendor ||
                    Number(draftAmount) <= 0
                  )
                    return;
                  setDraftAmount('');
                  setSelectedVendor('');
                }}
                className="rounded-xl bg-[#1e293b] text-white px-3 py-2 text-sm font-black"
              >
                Save Manual
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[1.75rem] border border-gray-100 bg-white p-5 shadow-sm">
          <div className="text-2xl font-black text-[#052e36]">
            Vendor Management
          </div>
          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
            <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
              Invoice Vendors
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {visibleInvoiceVendors.length > 0 ? (
                visibleInvoiceVendors.map((name) => (
                  <div
                    key={name}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-black text-[#052e36]"
                  >
                    {name}
                    <button
                      type="button"
                      className="text-gray-400 hover:text-red-500"
                      onClick={() =>
                        setDismissedInvoiceVendors(
                          (prev) => [...prev, name],
                        )
                      }
                      title="Hide vendor suggestion"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <form action={addSupplierFormAction}>
                      <input
                        type="hidden"
                        name="branch_id"
                        value={branchId}
                      />
                      <input
                        type="hidden"
                        name="vendor_name"
                        value={name}
                      />
                      <button
                        type="submit"
                        className="rounded-full bg-[#2563eb] text-white px-2 py-0.5 text-[10px]"
                      >
                        Add
                      </button>
                    </form>
                  </div>
                ))
              ) : (
                <div className="text-xs font-bold text-gray-400">
                  No invoice vendors available.
                </div>
              )}
            </div>
            <form
              action={addSupplierFormAction}
              className="mt-2"
            >
              <input
                type="hidden"
                name="branch_id"
                value={branchId}
              />
              <input
                type="hidden"
                name="vendor_names"
                value={JSON.stringify(
                  visibleInvoiceVendors,
                )}
              />
              <button
                type="submit"
                className="rounded-lg bg-[#052e36] text-white px-3 py-1.5 text-xs font-black"
              >
                Add all invoice vendors
              </button>
            </form>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <form
              action={addSupplierFormAction}
              className="flex-1 flex gap-2"
            >
              <input
                type="hidden"
                name="branch_id"
                value={branchId}
              />
              <input
                name="vendor_name"
                value={watchlistInput}
                onChange={(e) =>
                  setWatchlistInput(e.target.value)
                }
                placeholder="New vendor name..."
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#052e36] focus:outline-none focus:border-[#2563eb]"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#1e293b] px-3 py-2 text-xs font-black text-white"
              >
                Add Supplier
              </button>
            </form>
          </div>
          <div className="mt-3 space-y-2 max-h-44 overflow-y-auto pr-1">
            {suppliers.length === 0 ? (
              <div className="text-xs font-bold text-gray-400">
                No suppliers saved yet.
              </div>
            ) : (
              suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="rounded-xl border border-gray-100 bg-[#f8fafc] px-3 py-2 text-sm font-bold text-[#052e36] flex items-center justify-between gap-2"
                >
                  <span className="truncate">
                    {supplier.name}
                  </span>
                  <form action={deleteSupplierFormAction}>
                    <input
                      type="hidden"
                      name="branch_id"
                      value={branchId}
                    />
                    <input
                      type="hidden"
                      name="supplier_id"
                      value={supplier.id}
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-[10px] font-black text-red-500 hover:bg-red-50"
                      title="Delete supplier"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-gray-100 bg-white p-5 shadow-sm">
          <div className="text-sm font-black text-[#052e36]">
            Vendor Cost Table
          </div>
          <div className="mt-3 space-y-2 max-h-44 overflow-y-auto pr-1">
            {vendorCostRows.length > 0 ? (
              vendorCostRows.map((vendor) => (
                <div
                  key={vendor.id}
                  className="rounded-xl border border-gray-100 bg-[#f8fafc] px-3 py-2 flex items-center justify-between gap-3"
                >
                  <div className="text-sm font-black text-[#052e36] truncate">
                    {vendor.name}
                  </div>
                  <div className="text-sm font-black text-[#2563eb] whitespace-nowrap">
                    ${formatNumberEn(vendor.total)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs font-bold text-gray-400">
                No vendor invoice costs this period.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-gray-100 bg-white p-5 shadow-sm">
        <div className="text-sm font-black text-[#052e36]">
          Food Cost Categories
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {topSpendTiles.map((tile) => (
            <div
              key={tile.id}
              className="rounded-xl border border-gray-100 bg-[#f8fafc] px-3 py-2"
            >
              <div className="text-[10px] font-black text-gray-400 uppercase">
                Food
              </div>
              <div className="text-lg font-black text-[#052e36]">
                ${formatNumberEn(tile.amount)}
              </div>
              <div className="text-xs font-bold text-gray-500 mt-1 truncate">
                {tile.label}
              </div>
            </div>
          ))}
          {topSpendTiles.length === 0 ? (
            <div className="text-xs font-bold text-gray-400">
              No food-item spend found this period.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
