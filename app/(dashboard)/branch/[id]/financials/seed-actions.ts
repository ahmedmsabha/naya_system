"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";

export type FinancialSeedResult = { success: true; message: string } | { success: false; error: string };

const branchIdSchema = z.string().uuid();
const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

type IngredientRow = { id: string; name: string; unit: string };

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomPrice(): number {
  return Number((10 + Math.random() * 15).toFixed(2));
}

function classifyTags(name: string): Set<string> {
  const s = name.toLowerCase();
  const tags = new Set<string>();
  if (/beef|chicken|lamb|pork|turkey|fish|shrimp|salmon|tuna|meat|steak|patty|kebab|ground/.test(s)) {
    tags.add("protein");
  }
  if (/bread|bun|brioche|bagel|wrap|pita|tortilla|roll|flatbread/.test(s)) {
    tags.add("carb_bread");
  }
  if (/rice|quinoa|couscous|pasta|noodle|spaghetti|macaroni|grain/.test(s)) {
    tags.add("carb_grain");
  }
  if (/lettuce|tomato|onion|pepper|pickle|cucumber|salad|herb|spinach|arugula|veg|vegetable|greens/.test(s)) {
    tags.add("veg");
  }
  if (/cheese|cheddar|mozzarella|feta|cream|butter|milk|yogurt|dairy/.test(s)) {
    tags.add("dairy");
  }
  if (/oil|sauce|mayo|ketchup|mustard|dressing|vinegar|spice|salt|seasoning|harissa|tahini/.test(s)) {
    tags.add("condiment");
  }
  if (tags.size === 0) tags.add("other");
  return tags;
}

function gramsForIngredient(ing: IngredientRow, scale: number): number {
  const u = ing.unit.toLowerCase();
  const base = 60 + Math.floor(Math.random() * 80);
  if (u === "g") return Math.round(base * scale);
  if (u === "kg") {
    const kg = (0.08 + Math.random() * 0.14) * scale;
    return Number((kg * 1000).toFixed(4));
  }
  if (u === "ml" || u === "l") return Math.round((25 + Math.random() * 45) * scale);
  if (u === "piece") return Math.round((90 + Math.random() * 70) * scale);
  return Math.round(100 * scale);
}

function pickFirst<T>(items: T[], pred: (x: T) => boolean): T | undefined {
  return items.find(pred);
}

function buildRecipeBlueprints(ingredients: IngredientRow[]): Array<{ name: string; items: Array<{ ingredientId: string; quantityGrams: number }> }> {
  const byTag = new Map<string, IngredientRow[]>();
  for (const ing of ingredients) {
    for (const tag of classifyTags(ing.name)) {
      const list = byTag.get(tag) ?? [];
      list.push(ing);
      byTag.set(tag, list);
    }
  }

  const protein = pickFirst(byTag.get("protein") ?? [], () => true);
  const bread = pickFirst(byTag.get("carb_bread") ?? [], () => true);
  const grain = pickFirst(byTag.get("carb_grain") ?? [], () => true);
  const veg = pickFirst(byTag.get("veg") ?? [], () => true);
  const dairy = pickFirst(byTag.get("dairy") ?? [], () => true);
  const condiment = pickFirst(byTag.get("condiment") ?? [], () => true);

  const blueprints: Array<{ name: string; items: Array<{ ingredientId: string; quantityGrams: number }> }> = [];

  if (protein && bread) {
    const items: Array<{ ingredientId: string; quantityGrams: number }> = [
      { ingredientId: protein.id, quantityGrams: gramsForIngredient(protein, 1.1) },
      { ingredientId: bread.id, quantityGrams: gramsForIngredient(bread, 1) },
    ];
    if (veg && veg.id !== protein.id && veg.id !== bread.id) {
      items.push({ ingredientId: veg.id, quantityGrams: gramsForIngredient(veg, 0.6) });
    }
    if (condiment && !items.some((i) => i.ingredientId === condiment.id)) {
      items.push({ ingredientId: condiment.id, quantityGrams: gramsForIngredient(condiment, 0.5) });
    }
    blueprints.push({ name: "Signature Burger", items });
  }

  if (protein && grain) {
    const items: Array<{ ingredientId: string; quantityGrams: number }> = [
      { ingredientId: protein.id, quantityGrams: gramsForIngredient(protein, 1.2) },
      { ingredientId: grain.id, quantityGrams: gramsForIngredient(grain, 1) },
    ];
    if (veg && !items.some((i) => i.ingredientId === veg.id)) {
      items.push({ ingredientId: veg.id, quantityGrams: gramsForIngredient(veg, 0.7) });
    }
    blueprints.push({ name: "Market Bowl", items });
  }

  if (veg && dairy) {
    blueprints.push({
      name: "Garden Plate",
      items: [
        { ingredientId: veg.id, quantityGrams: gramsForIngredient(veg, 1) },
        { ingredientId: dairy.id, quantityGrams: gramsForIngredient(dairy, 0.8) },
      ],
    });
  }

  const used = new Set<string>();
  for (const bp of blueprints) {
    for (const line of bp.items) used.add(line.ingredientId);
  }

  const remaining = ingredients.filter((i) => !used.has(i.id));
  if (blueprints.length < 3 && remaining.length > 0) {
    const slice = remaining.slice(0, Math.min(3, remaining.length));
    blueprints.push({
      name: "Chef's Market Plate",
      items: slice.map((ing, idx) => ({
        ingredientId: ing.id,
        quantityGrams: gramsForIngredient(ing, 0.9 + idx * 0.05),
      })),
    });
  }

  if (blueprints.length === 0) {
    const slice = ingredients.slice(0, Math.min(4, ingredients.length));
    blueprints.push({
      name: "House Special",
      items: slice.map((ing, idx) => ({
        ingredientId: ing.id,
        quantityGrams: gramsForIngredient(ing, 1 + idx * 0.05),
      })),
    });
  }

  return blueprints.slice(0, Math.min(4, blueprints.length));
}

export async function generateDummyFinancialData(branchId: string, period: string): Promise<FinancialSeedResult> {
  const idParsed = branchIdSchema.safeParse(branchId);
  const periodParsed = periodSchema.safeParse(period);
  if (!idParsed.success || !periodParsed.success) {
    return { success: false, error: "Invalid branch or period." };
  }

  const access = await authorize({ module: "financials", action: "edit", branchId });
  if (!access.ok) {
    return { success: false, error: access.reason ?? "You do not have permission to seed financial data." };
  }

  const supabase = await createClient();

  const { data: branchRow, error: branchErr } = await supabase.from("branches").select("id").eq("id", branchId).maybeSingle();
  if (branchErr) return { success: false, error: branchErr.message };
  if (!branchRow) return { success: false, error: "Branch not found." };

  const { data: ingredientRows, error: ingErr } = await supabase
    .from("ingredients")
    .select("id, name, unit")
    .order("name", { ascending: true });
  if (ingErr) return { success: false, error: ingErr.message };

  const ingredients = (ingredientRows ?? []) as IngredientRow[];
  if (ingredients.length === 0) {
    return { success: false, error: "No ingredients found. Add warehouse ingredients before seeding." };
  }

  let recipeRows: Array<{ id: string; selling_price: number }>;

  const { data: existingRecipes, error: existingErr } = await supabase
    .from("recipes")
    .select("id, selling_price")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(40);

  if (existingErr) return { success: false, error: existingErr.message };

  let createdRecipeCount = 0;

  if ((existingRecipes?.length ?? 0) > 0) {
    recipeRows = (existingRecipes ?? []).map((r) => ({
      id: String(r.id),
      selling_price: Number(r.selling_price ?? 12),
    }));
  } else {
    const blueprints = buildRecipeBlueprints(ingredients);
    const inserted: Array<{ id: string; selling_price: number }> = [];

    for (const bp of blueprints) {
      const sellingPrice = randomPrice();
      const { data: recipe, error: recipeErr } = await supabase
        .from("recipes")
        .insert({
          name: bp.name,
          selling_price: sellingPrice,
          is_active: true,
        })
        .select("id, selling_price")
        .single();

      if (recipeErr || !recipe) {
        return { success: false, error: recipeErr?.message ?? "Failed to create recipe." };
      }

      const itemsPayload = bp.items.map((line) => ({
        recipe_id: recipe.id,
        ingredient_id: line.ingredientId,
        quantity_grams: Number(line.quantityGrams.toFixed(4)),
      }));

      const { error: itemsErr } = await supabase.from("recipe_items").insert(itemsPayload);
      if (itemsErr) {
        return { success: false, error: itemsErr.message };
      }

      inserted.push({ id: String(recipe.id), selling_price: Number(recipe.selling_price) });
      createdRecipeCount += 1;
    }

    recipeRows = inserted;
  }

  if (recipeRows.length === 0) {
    return { success: false, error: "No recipes available to attach sales." };
  }

  const [yStr, mStr] = period.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const daysInMonth = new Date(y, m, 0).getDate();

  const saleCount = randomInt(20, 30);
  const salesPayload = [];

  for (let i = 0; i < saleCount; i += 1) {
    const recipe = recipeRows[randomInt(0, recipeRows.length - 1)];
    const day = randomInt(1, daysInMonth);
    const saleDate = `${period}-${String(day).padStart(2, "0")}`;
    const qty = randomInt(1, 5);
    const unitPrice = Number(
      Math.max(10, Math.min(25, recipe.selling_price + (Math.random() * 1.2 - 0.4))).toFixed(2),
    );
    const channel: "delivery" | "dine_in" = Math.random() < 0.55 ? "delivery" : "dine_in";

    salesPayload.push({
      branch_id: branchId,
      recipe_id: recipe.id,
      quantity_sold: qty,
      unit_price: unitPrice,
      sale_date: saleDate,
      source: channel,
    });
  }

  const { error: salesErr } = await supabase.from("sales").insert(salesPayload);
  if (salesErr) {
    return { success: false, error: salesErr.message };
  }

  revalidatePath(`/branch/${branchId}/financials`);

  const message =
    createdRecipeCount > 0
      ? `Created ${createdRecipeCount} menu item(s) with ingredient breakdowns and ${saleCount} sales for ${period}.`
      : `Recorded ${saleCount} sample sales for ${period} using existing menu items.`;

  return { success: true, message };
}

export async function generateDummyFinancialDataForm(
  _prev: FinancialSeedResult | undefined,
  formData: FormData,
): Promise<FinancialSeedResult> {
  const branchId = String(formData.get("branch_id") ?? "").trim();
  const period = String(formData.get("period") ?? "").trim();
  return generateDummyFinancialData(branchId, period);
}
