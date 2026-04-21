import {
  isMonthlyPnLExpenseCategory,
  type MonthlyPnLExpenseCategory,
} from "@/lib/finance/monthly-pnl";

/**
 * Context passed when resolving which P&amp;L expense line an ingredient belongs to for variance / theoretical cost.
 * When `ingredients.category` exists in the database, prefer that and bypass rule matching.
 */
export type IngredientCategoryContext = {
  name: string;
  unit?: string | null;
  /** Future: column on `ingredients` — takes precedence over rules when set. */
  dbCategory?: string | null;
};

export type IngredientCategoryRule = {
  /** Stable id for logging / tenant overrides (e.g. in JSON config). */
  id: string;
  category: MonthlyPnLExpenseCategory;
  /** Return true when this ingredient should roll up to `category`. First match wins. */
  matches: (ctx: IngredientCategoryContext) => boolean;
};

/**
 * Default rules for mapping ingredient **names** (and optional unit) to P&amp;L expense categories.
 * Replace with `ctx.dbCategory` from Supabase once the column exists, or load rules per-tenant from DB.
 */
export const DEFAULT_INGREDIENT_CATEGORY_RULES: IngredientCategoryRule[] = [
  {
    id: "bread",
    category: "Bread",
    matches: ({ name }) => /\bbread\b|bun|brioche/i.test(name),
  },
  {
    id: "paper_packaging",
    category: "Lenard Paper",
    matches: ({ name }) => /paper|packag|cup|container|napkin|box/i.test(name),
  },
  {
    id: "produce_keany",
    category: "Keany's",
    matches: ({ name }) => /keany|produce|greens|lettuce|tomato/i.test(name),
  },
  {
    id: "pfg",
    category: "PFG",
    matches: ({ name }) => /\bpfg\b/i.test(name),
  },
  {
    id: "warehouse_commissary",
    category: "Warehouse",
    matches: ({ name }) => /warehouse|commissary|central kitchen/i.test(name),
  },
];

/** Used when no rule matches — aligns with broad “general food / broadline” bucket. */
export const DEFAULT_INGREDIENT_FALLBACK_CATEGORY: MonthlyPnLExpenseCategory = "US Foods";

/**
 * Resolves the P&amp;L expense category for an ingredient row.
 * Later: if `ctx.dbCategory` is set and valid, return it directly (after normalization).
 */
export function resolveIngredientExpenseCategory(
  ctx: IngredientCategoryContext,
  rules: readonly IngredientCategoryRule[] = DEFAULT_INGREDIENT_CATEGORY_RULES,
  fallback: MonthlyPnLExpenseCategory = DEFAULT_INGREDIENT_FALLBACK_CATEGORY,
): MonthlyPnLExpenseCategory {
  const trimmed = ctx.dbCategory?.trim();
  if (trimmed && isMonthlyPnLExpenseCategory(trimmed)) {
    return trimmed;
  }
  const normalized: IngredientCategoryContext = {
    ...ctx,
    name: String(ctx.name ?? "").trim(),
  };
  if (!normalized.name) return fallback;
  for (const rule of rules) {
    if (rule.matches(normalized)) return rule.category;
  }
  return fallback;
}
