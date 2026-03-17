import { supabase } from '@/lib/supabaseClient';
import { Marketplace } from '@/types';

export interface CommissionRate {
  marketplace: Marketplace;
  category: string;
  rate: number;
  updated_at: string;
}

export interface CommissionRateRow {
  id?: string;
  user_id: string;
  marketplace: string;
  category: string;
  rate: number;
  updated_at: string;
}

export async function getUserCommissionRates(userId: string): Promise<CommissionRate[]> {
  const { data, error } = await supabase
    .from('commission_rates')
    .select('marketplace, category, rate, updated_at')
    .eq('user_id', userId);

  if (error || !data) return [];
  return data as CommissionRate[];
}

export async function getLastRatesUpdate(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('commission_rates')
    .select('updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.updated_at;
}

export async function upsertCommissionRates(
  userId: string,
  rates: Array<{ marketplace: string; category: string; rate: number }>
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();
  const rows: CommissionRateRow[] = rates.map((r) => ({
    user_id: userId,
    marketplace: r.marketplace,
    category: r.category,
    rate: r.rate,
    updated_at: now,
  }));

  const { error } = await supabase
    .from('commission_rates')
    .upsert(rows, { onConflict: 'user_id,marketplace,category' });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export function buildRateMap(rates: CommissionRate[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rates) {
    map.set(`${r.marketplace}::${r.category}`, r.rate);
  }
  return map;
}

export function lookupRate(
  rateMap: Map<string, number>,
  marketplace: string,
  category: string
): number | undefined {
  return rateMap.get(`${marketplace}::${category}`);
}
