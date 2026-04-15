'use client';

import { AlertTriangle, BarChart3, Loader2, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { VendorPayableCategory } from '@/lib/finance/monthly-pnl';

type SmartStatus = 'Under Budget' | 'Trend Rising' | 'Critical Increase';

type VendorBreakdownItem = {
  vendorName: VendorPayableCategory;
  total: number;
  sharePct: number;
  status: SmartStatus;
};

export type VendorSmartAnalysisData = {
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

type VendorSmartAnalysisProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onGenerate: () => void;
  data: VendorSmartAnalysisData | null;
  errorMessage: string | null;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function VendorSmartAnalysis({
  open,
  onOpenChange,
  isPending,
  onGenerate,
  data,
  errorMessage,
}: VendorSmartAnalysisProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0" dir="ltr">
        <div className="border-b border-slate-200 bg-white px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-950">Vendor Smart Report</DialogTitle>
            <DialogDescription className="text-slate-600">
              Executive-grade risk signals generated from six-month vendor behavior and AI analysis.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge className="rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700">
              Strategic Vendor Intelligence
            </Badge>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={onGenerate} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
              {isPending ? 'Generating...' : 'Generate Smart Report'}
            </Button>
          </div>

          {errorMessage ? <p className="text-sm font-semibold text-red-500">{errorMessage}</p> : null}

          <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 ${isPending ? 'opacity-70 pointer-events-none' : ''}`}>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Concentration Risk</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{formatPercent(data?.concentrationPct ?? 0)}</p>
              <p className="mt-1 text-sm text-slate-600">Top Vendor: {data?.concentrationVendor ?? '-'}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Forecasted Liability</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(data?.forecastLiability ?? 0)}</p>
              <p className="mt-1 text-sm text-slate-600">Projected next-month vendor spend</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Highest Volatility</p>
              <p className="mt-2 text-xl font-black text-slate-900">{data?.highestVolatilityVendor ?? '-'}</p>
              <p className="mt-1 text-sm text-slate-600">Score {Number(data?.volatilityScore ?? 0).toFixed(3)}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current Month Spend</p>
              <p className="mt-2 text-2xl font-black text-slate-900">
                {formatCurrency(data?.totalCurrentMonthSpend ?? 0)}
              </p>
              <p className="mt-1 text-sm text-slate-600">Total across all vendor categories</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">AI Executive Takeaways</p>
            <div className="mt-3 space-y-3">
              {(data?.insights ?? []).length > 0 ? (
                data?.insights.map((insight) => (
                  <div
                    key={insight}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                  >
                    <TrendingUp className="mt-0.5 h-4 w-4 text-indigo-600" />
                    <p className="text-sm font-medium text-slate-800">{insight}</p>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  <AlertTriangle className="h-4 w-4" />
                  Generate the report to see executive takeaways.
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
