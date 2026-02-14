import { User, PlanType } from '@/types';
import { supabase } from './supabaseClient';

async function ensureProfile(userId: string, email: string): Promise<User> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, plan, email_alerts_enabled')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      return {
        id: data.id,
        email: data.email,
        plan: (data.plan as PlanType) || 'free',
        email_alerts_enabled: !!data.email_alerts_enabled
      };
    }

    const { data: upsertData, error: upsertError } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, email, plan: 'free', email_alerts_enabled: false },
        { onConflict: 'id' }
      )
      .select('id, email, plan, email_alerts_enabled')
      .single();

    if (upsertError) {
      console.error('Error upserting profile:', upsertError);
      return { id: userId, email, plan: 'free', email_alerts_enabled: false };
    }

    return {
      id: upsertData.id,
      email: upsertData.email,
      plan: (upsertData.plan as PlanType) || 'free',
      email_alerts_enabled: !!upsertData.email_alerts_enabled
    };
  } catch (err) {
    console.error('Exception in ensureProfile:', err);
    return { id: userId, email, plan: 'free', email_alerts_enabled: false };
  }
}

export async function fetchProfile(userId: string, email: string): Promise<User> {
  return await ensureProfile(userId, email);
}

export async function updateProfile(userId: string, updates: Partial<User>): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
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
  const { error } = await supabase.from('profiles').update({ plan }).eq('id', userId);
  if (error) console.error('Error updating plan:', error);
}
