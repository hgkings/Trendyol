// ----------------------------------------------------------------
// MarketplaceRepository — Katman 8
// Tablolar: marketplace_connections, marketplace_secrets, marketplace_sync_logs
// marketplace_secrets: service_role ile erisim (RLS kilitli).
// ----------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  MarketplaceConnectionRow,
  MarketplaceSecretRow,
  MarketplaceSyncLogRow,
} from '@/lib/db/types'

export class MarketplaceRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  // ---- marketplace_connections ----

  async createConnection(data: {
    user_id: string
    marketplace: string
    store_name?: string
    seller_id?: string
    status?: string
  }): Promise<MarketplaceConnectionRow> {
    const { data: result, error } = await this.supabase
      .from('marketplace_connections')
      .insert({
        ...data,
        status: data.status ?? 'pending_test',
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Baglanti olusturulamadi: ${error.message}`)
    }

    return result as MarketplaceConnectionRow
  }

  async deleteConnection(connectionId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('marketplace_connections')
      .delete()
      .eq('id', connectionId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Baglanti silinemedi: ${error.message}`)
    }
  }

  async getConnectionsByUserId(userId: string): Promise<MarketplaceConnectionRow[]> {
    const { data, error } = await this.supabase
      .from('marketplace_connections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Baglantilar getirilemedi: ${error.message}`)
    }

    return (data ?? []) as MarketplaceConnectionRow[]
  }

  async getConnectionById(id: string): Promise<MarketplaceConnectionRow | null> {
    const { data, error } = await this.supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Baglanti getirilemedi: ${error.message}`)
    }

    return data as MarketplaceConnectionRow
  }

  async updateConnectionStatus(id: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from('marketplace_connections')
      .update({ status })
      .eq('id', id)

    if (error) {
      throw new Error(`Baglanti durumu guncellenemedi: ${error.message}`)
    }
  }

  async updateLastSyncAt(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('marketplace_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      throw new Error(`Sync zamani guncellenemedi: ${error.message}`)
    }
  }

  // ---- marketplace_secrets (service_role) ----

  async storeSecrets(connectionId: string, encryptedBlob: string, keyVersion: number = 1): Promise<MarketplaceSecretRow> {
    const { data, error } = await this.supabase
      .from('marketplace_secrets')
      .upsert({
        connection_id: connectionId,
        encrypted_blob: encryptedBlob,
        key_version: keyVersion,
      }, { onConflict: 'connection_id' })
      .select()
      .single()

    if (error) {
      throw new Error(`Secret saklanamadi: ${error.message}`)
    }

    return data as MarketplaceSecretRow
  }

  async getSecrets(connectionId: string): Promise<MarketplaceSecretRow | null> {
    const { data, error } = await this.supabase
      .from('marketplace_secrets')
      .select('*')
      .eq('connection_id', connectionId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Secret getirilemedi: ${error.message}`)
    }

    return data as MarketplaceSecretRow
  }

  async getAllSecrets(): Promise<MarketplaceSecretRow[]> {
    const { data, error } = await this.supabase
      .from('marketplace_secrets')
      .select('*')

    if (error) {
      throw new Error(`Tum secret'lar getirilemedi: ${error.message}`)
    }

    return (data ?? []) as MarketplaceSecretRow[]
  }

  // ---- marketplace_sync_logs ----

  async createSyncLog(data: {
    connection_id: string
    sync_type: string
    status: string
    message?: string
  }): Promise<MarketplaceSyncLogRow> {
    const { data: result, error } = await this.supabase
      .from('marketplace_sync_logs')
      .insert(data)
      .select()
      .single()

    if (error) {
      throw new Error(`Sync log olusturulamadi: ${error.message}`)
    }

    return result as MarketplaceSyncLogRow
  }

  async updateSyncLog(id: string, status: string, message?: string): Promise<void> {
    const { error } = await this.supabase
      .from('marketplace_sync_logs')
      .update({
        status,
        message: message ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      throw new Error(`Sync log guncellenemedi: ${error.message}`)
    }
  }
}
