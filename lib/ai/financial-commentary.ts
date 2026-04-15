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
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return fallbackCommentary(payload);

  const contextJson = JSON.stringify(payload.context, null, 2);
  const prompt = `You are an executive financial analyst for a restaurant group.

Return exactly 3 short executive insights in English.
Use only the provided metrics. Do not invent, estimate, or assume any number.
If a metric is missing, skip it and rely on available data.

Output format (strict JSON only):
{
  "insights": ["...", "...", "..."]
}

Rules:
- Exactly 3 insights.
- Each insight maximum 22 words.
- Tone: sharp, board-level, action-oriented.
- No markdown, no bullets, no extra keys, no commentary.
- Use concrete figures where available (for example gross sales, net profit, net margin, food cost %, top loss sources, open alerts).

Input:
Focus: ${payload.focus}
Period: ${payload.period}
Branch: ${payload.branchName}

Financial Metrics JSON:
${contextJson}
`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const cleaned = cleanModelText(raw);
    const parsed = JSON.parse(cleaned) as { insights?: unknown };
    if (Array.isArray(parsed.insights)) {
      const insights = parsed.insights
        .map((value) => String(value).trim())
        .filter(Boolean)
        .slice(0, 3);
      if (insights.length === 3) return insights;
    }

    const lines = cleaned
      .split('\n')
      .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 3);
    if (lines.length === 3) return lines;

    return fallbackCommentary(payload);
  } catch {
    return fallbackCommentary(payload);
  }
}

type VendorCommentaryPayload = {
  period: string;
  branchName: string;
  context: Record<string, unknown>;
};

function fallbackVendorCommentary(payload: VendorCommentaryPayload): string[] {
  const highestVolatilityVendor = String(payload.context.highestVolatilityVendor ?? 'Top vendor');
  const volatilityScore = toFinite(payload.context.volatilityScore);
  const concentrationVendor = String(payload.context.concentrationVendor ?? 'Top vendor');
  const concentrationPct = toFinite(payload.context.concentrationPct);
  const forecastLiability = toFinite(payload.context.forecastLiability);

  return [
    `${highestVolatilityVendor} shows the highest spend volatility with a coefficient score of ${volatilityScore.toFixed(2)} over six months.`,
    `Dependency on ${concentrationVendor} is ${concentrationPct.toFixed(1)}% of current-month spend, creating measurable concentration risk.`,
    `Projected vendor liability for next month is $${forecastLiability.toFixed(0)} if the current six-month trajectory continues.`,
  ];
}

export async function generateVendorSmartCommentary(
  payload: VendorCommentaryPayload,
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return fallbackVendorCommentary(payload);

  const contextJson = JSON.stringify(payload.context, null, 2);
  const prompt = `You are a board-level procurement and finance strategist for a restaurant group.

Return exactly 3 short executive insights in English.
Use only the provided metrics. Do not invent any number.

Output format (strict JSON only):
{
  "insights": ["...", "...", "..."]
}

Rules:
- Exactly 3 insights.
- Each insight maximum 26 words.
- Tone: concise, business-focused, and action-oriented.
- No markdown, no bullets, no extra keys, no commentary.
- Focus areas:
  1) Price volatility (or spend volatility proxy if unit prices are unavailable)
  2) Concentration risk (% of spend in top vendor)
  3) Forecasted next-month liability

Input:
Period: ${payload.period}
Branch: ${payload.branchName}

Vendor Metrics JSON:
${contextJson}
`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const cleaned = cleanModelText(raw);
    const parsed = JSON.parse(cleaned) as { insights?: unknown };
    if (Array.isArray(parsed.insights)) {
      const insights = parsed.insights
        .map((value) => String(value).trim())
        .filter(Boolean)
        .slice(0, 3);
      if (insights.length === 3) return insights;
    }

    const lines = cleaned
      .split('\n')
      .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 3);
    if (lines.length === 3) return lines;

    return fallbackVendorCommentary(payload);
  } catch {
    return fallbackVendorCommentary(payload);
  }
}
