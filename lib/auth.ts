import { User, PlanType, Marketplace } from '@/types';
import { createClient } from '@/lib/supabase/client';

// ----------------------------------------------------------------
// Auth islemleri — login/register server-side API proxy uzerinden.
// Session cookie ile tasinir, client-side Supabase SDK ile senkronize olur.
// ----------------------------------------------------------------

function mapProfileRow(data: Record<string, unknown>): User {
  // Gateway camelCase, DB snake_case — her ikisini destekle
  return {
    id: data.id as string,
    email: data.email as string,
    plan: (data.plan as PlanType) || 'free',
    pro_until: (data.pro_until ?? data.proUntil ?? null) as string | null,
    pro_expires_at: (data.pro_expires_at ?? data.proExpiresAt ?? null) as string | null,
    pro_renewal: (data.pro_renewal ?? data.proRenewal ?? true) as boolean,
    pro_started_at: (data.pro_started_at ?? data.proStartedAt ?? null) as string | null,
    email_notifications_enabled: (data.email_notifications_enabled ?? data.emailNotificationsEnabled) !== false,
    target_margin: (data.target_margin ?? data.targetMargin) as number | undefined,
    margin_alert: (data.margin_alert ?? data.marginAlert) as boolean | undefined,
    default_marketplace: (data.default_marketplace ?? data.defaultMarketplace) as Marketplace | undefined,
    default_commission: (data.default_commission ?? data.defaultCommission) as number | undefined,
    default_vat: (data.default_vat ?? data.defaultVat) as number | undefined,
    monthly_profit_target: (data.monthly_profit_target ?? data.monthlyProfitTarget) as number | undefined,
    default_return_rate: (data.default_return_rate ?? data.defaultReturnRate) as number | undefined,
    default_ads_cost: (data.default_ads_cost ?? data.defaultAdsCost) as number | undefined,
    fixed_cost_monthly: (data.fixed_cost_monthly ?? data.fixedCostMonthly) as number | undefined,
    target_profit_monthly: (data.target_profit_monthly ?? data.targetProfitMonthly) as number | undefined,
    email_weekly_report: ((data.email_weekly_report ?? data.emailWeeklyReport) as boolean) ?? true,
    email_risk_alert: ((data.email_risk_alert ?? data.emailRiskAlert) as boolean) ?? true,
    email_margin_alert: ((data.email_margin_alert ?? data.emailMarginAlert) as boolean) ?? true,
    email_pro_expiry: ((data.email_pro_expiry ?? data.emailProExpiry) as boolean) ?? true,
  };
}

export async function fetchProfile(userId: string, email: string): Promise<User> {
  try {
    const res = await fetch('/api/user/profile');
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) return mapProfileRow(data);
    }

    // Profil yoksa sadece temel bilgilerle oluştur — plan'a dokunma!
    const createRes = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, email_notifications_enabled: true }),
    });

    if (createRes.ok) {
      const newData = await createRes.json();
      if (newData && newData.id) return mapProfileRow(newData);
    }

    return { id: userId, email, plan: 'free', email_notifications_enabled: true };
  } catch {
    return { id: userId, email, plan: 'free', email_notifications_enabled: true };
  }
}

export async function updateProfile(userId: string, updates: Partial<User>): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    return { success: res.ok, error: data.error };
  } catch {
    return { success: false, error: 'Profil güncellenemedi.' };
  }
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string; mfaRequired?: boolean }> {
  try {
    // Server-side proxy — rate limit + audit log + cookie session
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const result = await res.json();

    if (!res.ok) {
      return { success: false, error: result.error ?? 'Giriş başarısız.' };
    }

    // MFA gerekiyorsa profil çekmeye gerek yok
    if (result.mfaRequired) {
      return { success: true, mfaRequired: true };
    }

    // Cookie set edildi — server'dan dönen userId/email ile profil çek.
    // NOT: Browser Supabase client singleton'ı cookie'leri hemen görmeyebilir,
    // bu yüzden getUser() yerine server'dan dönen bilgiyi kullanıyoruz.
    // fetchProfile() içindeki fetch('/api/user/profile') çağrısı yeni cookie'leri
    // otomatik gönderir (browser cookie jar hemen güncellenir).
    const userId = result.userId as string;
    const userEmail = (result.email as string) ?? email;

    const user = await fetchProfile(userId, userEmail);
    return { success: true, user };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Beklenmeyen hata';
    return { success: false, error: message };
  }
}

export async function register(
  email: string,
  password: string,
  fullName?: string
): Promise<{ success: boolean; user?: User; error?: string; needsEmailConfirmation?: boolean }> {
  try {
    // Server-side proxy — rate limit + audit log + cookie session
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName }),
    });

    const result = await res.json();

    if (!res.ok) {
      return { success: false, error: result.error ?? 'Kayıt başarısız.' };
    }

    // Email doğrulaması gerekiyorsa session yok — profil çekme
    if (result.needsEmailConfirmation) {
      return {
        success: true,
        needsEmailConfirmation: true,
      };
    }

    // Session var (email doğrulaması kapalıysa) — profil çek
    const userId = result.userId as string;
    const userEmail = (result.email as string) ?? email;

    const user = await fetchProfile(userId, userEmail);
    return { success: true, user };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Beklenmeyen hata';
    return { success: false, error: message };
  }
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function updateUserPlan(userId: string, plan: PlanType): Promise<void> {
  await fetch('/api/user/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
}
