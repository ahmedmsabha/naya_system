import Link from "next/link";
import type { ComponentType } from "react";
import { ArrowLeft, BarChart3, ChevronRight, ScanLine, Truck, Users, Warehouse } from "lucide-react";
import { parsePeriod, monthKeyNow, addMonths, monthLabel } from "@/lib/domain/date";
import {
  formatAccountingCurrency,
  isNetLoss,
  netProfitLossLabel,
} from "@/lib/domain/money";
import { requireBranchHubAccessOrRedirect } from "@/lib/navigation/branch-landing";
import { getBranchHubData } from "./queries";

export default async function BranchDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  await requireBranchHubAccessOrRedirect(id);
  const sp = await searchParams;
  const selectedPeriod = parsePeriod(sp.period, monthKeyNow());
  const data = await getBranchHubData(id, selectedPeriod);

  const modules: Array<{
    id: string;
    href: string;
    title: string;
    subtitle: string;
    icon: ComponentType<{ className?: string }>;
    kpiLabel: string;
    kpiValue: string;
  }> = [
    {
      id: "warehouse",
      href: `/branch/${id}/warehouse`,
      title: "Warehouse",
      subtitle: "Inventory, transfer readiness, and controls",
      icon: Warehouse,
      kpiLabel: "Inventory Value",
      kpiValue: formatAccountingCurrency(data.kpis.warehouseValue),
    },
    {
      id: "financials",
      href: `/branch/${id}/financials/performance?period=${selectedPeriod}`,
      title: "Financials",
      subtitle: "P&L intelligence and margin tracking",
      icon: BarChart3,
      kpiLabel: "Net Margin",
      kpiValue: `${data.kpis.netMarginPct.toFixed(1)}%`,
    },
    {
      id: "vendors",
      href: `/branch/${id}/vendors`,
      title: "Vendors",
      subtitle: "Invoices, payables, and supplier control",
      icon: Truck,
      kpiLabel: "Monthly Spend",
      kpiValue: formatAccountingCurrency(data.kpis.vendorSpend),
    },
    {
      id: "staffing",
      href: `/branch/${id}/staffing`,
      title: "Staffing",
      subtitle: "Headcount and labor planning",
      icon: Users,
      kpiLabel: "Active Staff",
      kpiValue: `${data.kpis.activeStaff}`,
    },
  ];

  const periodOptions = Array.from({ length: 12 }, (_, index) => {
    const period = addMonths(monthKeyNow(), -index);
    return { value: period, label: monthLabel(period) };
  });

  return (
    <div className="max-w-7xl space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.22em] text-slate-500 hover:text-slate-700 transition-colors uppercase"
      >
        <ArrowLeft className="w-4 h-4" />
        Back To Enterprise Overview
      </Link>

      <div className="rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.45)]">
        <p className="text-xs uppercase tracking-[0.26em] font-black text-slate-500">Naya Enterprise</p>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#052e36]">
              {data.branchName}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Executive operations hub for monthly control and branch performance.
            </p>
          </div>
          <form action="" className="w-full lg:w-auto">
            <label htmlFor="period" className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Reporting Period
            </label>
            <select
              id="period"
              name="period"
              defaultValue={selectedPeriod}
              className="w-full min-w-[240px] rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 shadow-inner"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="mt-3 inline-flex rounded-2xl bg-[#052e36] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-slate-300/40"
            >
              Apply
            </button>
          </form>
        </div>
      </div>

      {data.branchType === "branch" && (
        <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50/90 to-white p-6 shadow-[0_16px_40px_-28px_rgba(37,99,235,0.45)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">Logistics</p>
              <p className="mt-1 text-lg font-black text-[#052e36]">Incoming commissary shipment?</p>
              <p className="mt-1 text-sm text-slate-600">
                Open the scanner to receive against a label QR and update branch stock.
              </p>
            </div>
            <Link
              href={`/branch/${id}/orders/scan`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#2563eb] px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-blue-200/50 hover:bg-blue-600 transition-colors"
            >
              <ScanLine className="w-5 h-5" />
              Scan incoming shipment
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((module) => (
          <Link
            key={module.id}
            href={module.href}
            className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_22px_55px_-38px_rgba(15,23,42,0.55)] transition-all hover:-translate-y-0.5 hover:shadow-[0_30px_70px_-35px_rgba(37,99,235,0.35)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                <module.icon className="w-6 h-6 text-slate-700" />
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-700 transition-colors" />
            </div>
            <h2 className="mt-5 text-2xl font-black text-[#052e36]">{module.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{module.subtitle}</p>
            <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">{module.kpiLabel}</p>
              <p className="mt-1 text-xl font-black text-slate-900">{module.kpiValue}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_42px_-34px_rgba(15,23,42,0.75)]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
            {netProfitLossLabel(data.kpis.netProfit)}
          </p>
          <p
            className={`mt-2 text-2xl font-black ${
              isNetLoss(data.kpis.netProfit) ? "text-rose-600" : "text-emerald-600"
            }`}
          >
            {formatAccountingCurrency(data.kpis.netProfit)}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_42px_-34px_rgba(15,23,42,0.75)]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Current Period</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{monthLabel(selectedPeriod)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_42px_-34px_rgba(15,23,42,0.75)]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Executive Mode</p>
          <p className="mt-2 text-2xl font-black text-[#2563eb]">Design-Led Refactor</p>
        </div>
      </div>

    </div>
  );
}
