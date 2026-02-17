import { Analysis, RiskLevel, Notification } from '@/types';
import { supabase } from './supabaseClient';

interface AnalysisRow {
  id: string;
  user_id: string;
  marketplace: string;
  product_name: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  risk_score: number;
  risk_level: string;
  created_at: string;
  competitor_price?: number;
  competitor_name?: string;
  target_position?: string;
}

function rowToAnalysis(row: AnalysisRow): Analysis {
  const outputs = row.outputs as Record<string, unknown>;
  const riskFactors = Array.isArray(outputs._risk_factors) ? outputs._risk_factors : [];

  return {
    id: row.id,
    userId: row.user_id,
    input: {
      ...(row.inputs as unknown as Analysis['input']),
      competitor_price: row.competitor_price,
      competitor_name: row.competitor_name,
      target_position: row.target_position as any,
    },
    result: row.outputs as unknown as Analysis['result'],
    risk: {
      score: row.risk_score,
      level: row.risk_level as RiskLevel,
      factors: riskFactors,
    },
    createdAt: row.created_at,
  };
}

export async function getStoredAnalyses(userId: string): Promise<Analysis[]> {
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map(rowToAnalysis);
}

export async function getAnalysisById(userId: string, id: string): Promise<Analysis | null> {
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return rowToAnalysis(data);
}

import { checkAnalysisLimit } from './plan';
import { PLAN_LIMITS } from '@/config/plans';

export async function saveAnalysis(analysis: Analysis): Promise<{ success: boolean; error?: string }> {
  // Only check limits for NEW analyses (not updates)
  const { data: existing } = await supabase.from('analyses').select('id').eq('id', analysis.id).maybeSingle();

  if (!existing) {
    const allowed = await checkAnalysisLimit(analysis.userId);
    if (!allowed) {
      return { success: false, error: `Ücretsiz plan limiti aşıldı (Maksimum ${PLAN_LIMITS.free.maxProducts} analiz). Pro plana geçerek sınırsız analiz yapabilirsiniz.` };
    }
  }

  // Runtime guard for sale_price
  if (!Number.isFinite(analysis.input.sale_price) || analysis.input.sale_price <= 0) {
    console.error('Invalid sale_price:', analysis.input.sale_price);
    // We could throw here, but let's try to fix it or just log for now to avoid crashing valid saves if partially bad
    // Actually per request: "throw new Error"
    return { success: false, error: "SALE_PRICE_MISSING_OR_INVALID" };
  }

  const outputsWithRisk = {
    ...analysis.result,
    _risk_factors: analysis.risk.factors,
  };

  const row = {
    id: analysis.id,
    user_id: analysis.userId,
    marketplace: analysis.input.marketplace,
    product_name: analysis.input.product_name,
    inputs: analysis.input as unknown as Record<string, unknown>,
    outputs: outputsWithRisk as unknown as Record<string, unknown>,
    risk_score: analysis.risk.score,
    risk_level: analysis.risk.level,
    competitor_price: analysis.input.competitor_price,
    competitor_name: analysis.input.competitor_name,
    target_position: analysis.input.target_position,
  };

  const { error } = await supabase.from('analyses').upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('saveAnalysis error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteAnalysis(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('analyses').delete().eq('id', id);
  if (error) {
    console.error('deleteAnalysis error:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function getUserAnalysisCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) return 0;
  return count || 0;
}

export function generateId(): string {
  // Use native crypto.randomUUID if available (browsers + Node 19+)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function getNotifications(userId: string, limit = 50): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as Notification[];
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
}

export async function upsertNotifications(notifications: Partial<Notification>[]): Promise<void> {
  if (notifications.length === 0) return;
  const { error } = await supabase.from('notifications').upsert(notifications, { onConflict: 'user_id, dedupe_key' });
  if (error) {
    console.error('upsertNotifications error:', error);
  }
}
// Sidebar Stats Aggregation
export async function getSidebarStats(userId: string): Promise<{ total: number; profitable: number; risky: number; lastUpdated: string | null }> {
  const { data: analyses, error } = await supabase
    .from('analyses')
    .select('outputs, risk_level, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !analyses) return { total: 0, profitable: 0, risky: 0, lastUpdated: null };

  const total = analyses.length;
  let profitable = 0;
  let risky = 0;

  analyses.forEach((a: any) => {
    // Profitable: monthly_net_profit > 0
    if (Number(a.outputs?.monthly_net_profit) > 0) {
      profitable++;
    }
    // Risky: risk_level === 'High' or 'Critical'
    if (a.risk_level === 'High' || a.risk_level === 'Critical') {
      risky++;
    }
  });

  const lastUpdated = analyses.length > 0 ? analyses[0].created_at : null;

  return { total, profitable, risky, lastUpdated };
}
