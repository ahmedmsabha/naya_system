import { GoogleGenerativeAI } from '@google/generative-ai';

type FocusMode = 'financial' | 'variance';

type CommentaryPayload = {
  focus: FocusMode;
  period: string;
  branchName: string;
  context: Record<string, unknown>;
};

function cleanModelText(raw: string): string {
  return raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function toFinite(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fallbackCommentary(payload: CommentaryPayload): string[] {
  const grossSales = toFinite(payload.context.grossSales);
  const netProfit = toFinite(payload.context.netProfit);
  const netMargin = toFinite(payload.context.netMarginPct);
  const foodCost = toFinite(payload.context.foodCostPct);
  const laborCost = toFinite(payload.context.laborCostPct);
  const topDriver = String(payload.context.topDriver ?? 'cost variance');
  const openAlerts = toFinite(payload.context.openAlertsCount);

  if (payload.focus === 'variance') {
    const topLoss = toFinite(payload.context.topLossValue);
    const topLossName = String(payload.context.topLossName ?? 'key ingredient');
    const highRiskCount = toFinite(payload.context.highRiskVarianceItems);
    return [
      `Variance pressure is concentrated in ${topLossName}, with an estimated excess cost of $${topLoss.toFixed(0)} this period.`,
      `The matrix shows ${highRiskCount.toFixed(0)} ingredients above the 5% threshold, indicating process and portion-control leakage.`,
      `Gross sales are $${grossSales.toFixed(0)} with net margin at ${netMargin.toFixed(1)}%, so variance reduction should be prioritized to protect profitability.`,
    ];
  }

  return [
    `Gross sales reached $${grossSales.toFixed(0)} and net profit is $${netProfit.toFixed(0)}, resulting in a net margin of ${netMargin.toFixed(1)}%.`,
    `Food cost is ${foodCost.toFixed(1)}% and labor cost is ${laborCost.toFixed(1)}%; ${topDriver} is the primary driver to monitor this period.`,
    `Open alerts currently total ${openAlerts.toFixed(0)}, so daily operational controls should focus on waste, staffing efficiency, and expense discipline.`,
  ];
}

export async function generateFinancialCommentary(payload: CommentaryPayload): Promise<string[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return fallbackCommentary(payload);

  const prompt = `You are a CFO-grade restaurant analytics copilot.
Generate exactly 3 executive commentary sentences in English.

Rules:
- Keep each sentence under 30 words.
- Mention concrete numbers (currency or percentages) from the provided context.
- Be specific and operational, not generic.
- No markdown.
- Return strict JSON only:
{
  "insights": ["sentence1", "sentence2", "sentence3"]
}

Focus: ${payload.focus}
Period: ${payload.period}
Branch: ${payload.branchName}
Context JSON:
${JSON.stringify(payload.context, null, 2)}
`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const cleaned = cleanModelText(raw);
    const parsed = JSON.parse(cleaned) as { insights?: unknown };
    if (!Array.isArray(parsed.insights)) return fallbackCommentary(payload);

    const insights = parsed.insights
      .map((value) => String(value).trim())
      .filter(Boolean)
      .slice(0, 3);

    if (insights.length === 3) return insights;
    return fallbackCommentary(payload);
  } catch {
    return fallbackCommentary(payload);
  }
}
