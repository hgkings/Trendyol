// ----------------------------------------------------------------
// Supabase Admin Client — Service Role
// 🔒 KORUNAN DOSYA — Hilmi onayi olmadan degistirilemez.
// RLS'yi bypass eder. Sadece repositories/ ve cron job'lar kullanir.
// app/ veya components/ icinden ASLA import edilmez.
// ----------------------------------------------------------------

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let adminClient: SupabaseClient | null = null

/**
 * Singleton Supabase admin client dondurur.
 * Service role key kullanir — RLS'yi bypass eder.
 */
export function createAdminClient() {
  if (adminClient) return adminClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanimlanmamis'
    )
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return adminClient
}
