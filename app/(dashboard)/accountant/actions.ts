"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function addAccountantInvoice(formData: FormData) {
  const supabase = await createClient();
  const vendor = formData.get("vendor_name") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const project = formData.get("project_name") as string;
  const imageUrl = formData.get("image_url") as string;

  const { data, error } = await supabase
    .from("tarek_invoices")
    .insert({ vendor_name: vendor, amount, project_name: project, image_url: imageUrl })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/accountant");
  return { success: true, invoice: data };
}

export async function deleteAccountantInvoice(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tarek_invoices").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/accountant");
  return { success: true };
}

export async function scanReceiptWithAI(formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) return { error: "No file provided" };

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return { error: "GOOGLE_AI_API_KEY not set" };

  // Convert file to base64
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = file.type || "image/jpeg";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `You are a receipt scanner. Extract the following from this receipt image and respond ONLY with a JSON object, no markdown, no explanation:
{
  "vendor": "<store or company name>",
  "amount": "<total amount as a number string, e.g. 42.99>"
}
If you cannot find a value, use "Unknown" for vendor or "0.00" for amount.`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType, data: base64 } },
  ]);

  const raw = result.response.text().trim();

  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/```$/,"").trim();
    const parsed = JSON.parse(cleaned);
    return {
      vendor: String(parsed.vendor ?? "Unknown"),
      amount: String(parsed.amount ?? "0.00"),
    };
  } catch {
    // Fallback: try to extract from raw text
    const amountMatch = raw.match(/(\d{1,5}\.\d{2})/);
    return {
      vendor: "Unknown",
      amount: amountMatch ? amountMatch[1] : "0.00",
    };
  }
}

export async function uploadReceipt(file: File) {
  const supabase = await createClient();
  const fileName = `${Date.now()}-${file.name}`;
  
  // 1. Upload to Supabase Storage
  const { error } = await supabase.storage
    .from("receipts")
    .upload(fileName, file);

  if (error) return { error: error.message };

  const { data: { publicUrl } } = supabase.storage
    .from("receipts")
    .getPublicUrl(fileName);

  return { 
    url: publicUrl
  };
}
