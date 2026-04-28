import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { monthEndIso, monthStartIso } from "@/lib/domain/date";
import { toMoney } from "@/lib/domain/money";

export type BranchHubData = {
  branchId: string;
  branchName: string;
  branchType: string;
  period: string;
  kpis: {
    warehouseValue: number;
    netProfit: number;
    netMarginPct: number;
    vendorSpend: number;
    activeStaff: number;
  };
};

export async function getBranchHubData(branchId: string, period: string): Promise<BranchHubData> {
  const access = await authorize({ module: "dashboard", action: "read", branchId });
  if (!access.ok) notFound();

  const supabase = await createClient();
  const start = monthStartIso(period);
  const end = monthEndIso(period);

  const [
    { data: branch },
    { data: salesRows },
    { data: expenseRows },
    { data: vendorRows },
    { data: staffRows },
    { data: inventoryRows },
  ] = await Promise.all([
    supabase.from("branches").select("name, type").eq("id", branchId).single(),
    supabase
      .from("sales")
      .select("total_revenue")
      .eq("branch_id", branchId)
      .gte("sale_date", start)
      .lte("sale_date", end),
    supabase
      .from("branch_monthly_expenses")
      .select("amount")
      .eq("branch_id", branchId)
      .eq("month_period", period),
    supabase
      .from("vendor_invoices")
      .select("amount")
      .eq("branch_id", branchId)
      .gte("invoice_date", start)
      .lte("invoice_date", end),
    supabase
      .from("branch_staff")
      .select("id")
      .eq("branch_id", branchId)
      .eq("status", "active"),
    supabase
      .from("inventory")
      .select("quantity_on_hand, ingredients ( cost_per_unit )")
      .eq("branch_id", branchId),
  ]);

  if (!branch) notFound();

  const grossSales = (salesRows ?? []).reduce(
    (sum, row) => sum + toMoney(row.total_revenue),
    0,
  );
  const totalExpenses = (expenseRows ?? []).reduce(
    (sum, row) => sum + toMoney(row.amount),
    0,
  );
  const vendorSpend = (vendorRows ?? []).reduce(
    (sum, row) => sum + toMoney(row.amount),
    0,
  );
  const warehouseValue = (inventoryRows ?? []).reduce((sum, row) => {
    const ingredient = Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients;
    return sum + toMoney(row.quantity_on_hand) * toMoney(ingredient?.cost_per_unit, 4);
  }, 0);

  const netProfit = grossSales - totalExpenses;
  const netMarginPct = grossSales > 0 ? (netProfit / grossSales) * 100 : 0;

  return {
    branchId,
    branchName: String(branch.name ?? ""),
    branchType: String(branch.type ?? "branch"),
    period,
    kpis: {
      warehouseValue: toMoney(warehouseValue),
      netProfit: toMoney(netProfit),
      netMarginPct: toMoney(netMarginPct),
      vendorSpend: toMoney(vendorSpend),
      activeStaff: Number(staffRows?.length ?? 0),
    },
  };
}
