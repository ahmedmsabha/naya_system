import { redirect } from 'next/navigation';

export default async function BranchFinancialsIndexRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const raw = sp.period;
  const periodParam = Array.isArray(raw) ? raw[0] : raw;
  const q = periodParam ? `?period=${encodeURIComponent(periodParam)}` : '';
  redirect(`/branch/${id}/financials/performance${q}`);
}
