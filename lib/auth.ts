import { User, PlanType, Marketplace } from '@/types';
import { supabase } from './supabaseClient';

const PROFILE_SELECT_FULL = 'id, email, plan, email_notifications_enabled, target_margin, margin_alert, default_marketplace, default_commission, default_vat, monthly_profit_target, default_return_rate, default_ads_cost, fixed_cost_monthly, target_profit_monthly';
const PROFILE_SELECT_CORE = 'id, email, plan, email_notifications_enabled';

// Preference keys that may not exist as DB columns yet
const PREF_KEYS: (keyof User)[] = [
  'target_margin', 'margin_alert', 'default_marketplace', 'default_commission', 'default_vat', 'monthly_profit_target', 'default_return_rate', 'default_ads_cost',
  'fixed_cost_monthly', 'target_profit_monthly'
];

function mapProfileRow(data: any): User {
  return {
    id: data.id,
    email: data.email,
    plan: (data.plan as PlanType) || 'free',
    email_notifications_enabled: data.email_notifications_enabled !== false,
    target_margin: data.target_margin ?? undefined,
    margin_alert: data.margin_alert ?? undefined,
    default_marketplace: data.default_marketplace as Marketplace | undefined,
    default_commission: data.default_commission ?? undefined,
    default_vat: data.default_vat ?? undefined,
    monthly_profit_target: data.monthly_profit_target ?? undefined,
    default_return_rate: data.default_return_rate ?? undefined,
    default_ads_cost: data.default_ads_cost ?? undefined,
    fixed_cost_monthly: data.fixed_cost_monthly ?? undefined,
    target_profit_monthly: data.target_profit_monthly ?? undefined,
  };
}
async function ensureProfile(userId: string, email: string): Promise<User> {
  try {
    // Try full select first (includes preference columns)
    let { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT_FULL)
      .eq('id', userId)
      .maybeSingle();

    // If the select fails (columns don't exist yet), fall back to core columns
    if (error && error.code === '42703') {
      const fallback = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_CORE)
        .eq('id', userId)
        .maybeSingle();
      data = fallback.data as any;
      error = fallback.error;
    }

    if (data) {
      return mapProfileRow(data);
    }

    const { data: upsertData, error: upsertError } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, email, plan: 'free', email_notifications_enabled: true },
        { onConflict: 'id' }
      )
      .select(PROFILE_SELECT_FULL)
      .single();

    // Fallback if preference columns don't exist
    if (upsertError && upsertError.code === '42703') {
      const fb = await supabase
        .from('profiles')
        .upsert(
          { id: userId, email, plan: 'free', email_notifications_enabled: true },
          { onConflict: 'id' }
        )
        .select(PROFILE_SELECT_CORE)
        .single();
      if (!fb.error && fb.data) return mapProfileRow(fb.data);
    }

    if (upsertError) {
      console.error('Error upserting profile:', upsertError);
      return { id: userId, email, plan: 'free', email_notifications_enabled: true };
    }

    return mapProfileRow(upsertData);
  } catch (err) {
    console.error('Exception in ensureProfile:', err);
    return { id: userId, email, plan: 'free', email_notifications_enabled: true };
  }
}

export async function fetchProfile(userId: string, email: string): Promise<User> {
  return await ensureProfile(userId, email);
}

export async function updateProfile(userId: string, updates: Partial<User>): Promise<{ success: boolean; error?: string }> {
  // Only allow updating columns that actually exist in the profiles table
  const coreKeys: (keyof User)[] = ['email', 'plan', 'email_notifications_enabled'];
  const allAllowedKeys: (keyof User)[] = [...coreKeys, ...PREF_KEYS];

  const safeUpdates: Record<string, any> = {};
  for (const key of allAllowedKeys) {
    if (updates[key] !== undefined) safeUpdates[key] = updates[key];
  }

  const { error } = await supabase
    .from('profiles')
    .update(safeUpdates)
    .eq('id', userId);

  if (error) {
    // If error is "column does not exist", retry with only core keys
    if (error.code === '42703' || error.message.includes('column')) {
      const coreSafe: Record<string, any> = {};
      for (const key of coreKeys) {
        if (updates[key] !== undefined) coreSafe[key] = updates[key];
      }
      if (Object.keys(coreSafe).length > 0) {
        const { error: retryErr } = await supabase.from('profiles').update(coreSafe).eq('id', userId);
        if (retryErr) return { success: false, error: retryErr.message };
      }
      // Return partial success — core saved, preferences need migration
      return {
        success: false,
        error: 'Tercih sütunları henüz veritabanında oluşturulmamış. Lütfen Supabase SQL Editor\'da migration sorgusunu çalıştırın.',
      };
    }
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { success: false, error: `Giris hatasi: ${error.message}` };
    }
    if (!data.user || !data.user.email) {
      return { success: false, error: 'Oturum acilamadi.' };
    }

    const user = await fetchProfile(data.user.id, data.user.email);
    return { success: true, user };
  } catch (err: any) {
    return { success: false, error: `Beklenmeyen hata: ${err.message || err}` };
  }
}

export async function register(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  if (password.length < 6) {
    return { success: false, error: 'Sifre en az 6 karakter olmalidir.' };
  }

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      return { success: false, error: `Kayit hatasi: ${error.message}` };
    }
    if (!data.user || !data.user.email) {
      return { success: false, error: 'Kullanici olusturulamadi (Yonetici onayi veya e-posta dogrulamasi gerekebilir).' };
    }

    // Force profile creation
    const user = await fetchProfile(data.user.id, data.user.email);
    return { success: true, user };
  } catch (err: any) {
    return { success: false, error: `Beklenmeyen hata: ${err.message || err}` };
  }
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function updateUserPlan(userId: string, plan: PlanType): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ plan })
    .eq('id', userId);

  if (error) {
    console.error('Error updating plan:', error);
  } else if (process.env.NODE_ENV === 'development') {
    console.log('[Auth] Plan updated:', { userId, plan });
  }
}
