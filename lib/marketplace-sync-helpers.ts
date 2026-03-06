/**
 * Shared helpers for marketplace sync API routes.
 * Handles auth, ownership, credential decryption, and sync locking.
 *
 * Uses @supabase/supabase-js directly (NOT SSR createServerClient)
 * to guarantee RLS bypass on marketplace_secrets.
 */

import { createClient } from '@/lib/supabase-server-client';
import { decryptCredentials } from '@/lib/marketplace-crypto';
import type { TrendyolCredentials } from '@/lib/trendyol-api';
import { createClient as createDirectClient } from '@supabase/supabase-js';

/** Create a direct admin client that guarantees RLS bypass */
function getDirectAdmin() {
    return createDirectClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export interface SyncContext {
    userId: string;
    connectionId: string;
    sellerId: string;
    credentials: TrendyolCredentials;
    admin: ReturnType<typeof getDirectAdmin>;
}

/**
 * Authenticate user, verify connection ownership, decrypt credentials.
 * Returns null + error string if any step fails.
 */
export async function prepareSyncContext(
    connectionId?: string
): Promise<{ ctx: SyncContext | null; error: string | null; status: number }> {
    const supabase = createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
        return { ctx: null, error: 'Not authenticated', status: 401 };
    }

    const admin = getDirectAdmin();

    // If no connectionId, find user's Trendyol connection
    let connId = connectionId;
    if (!connId) {
        const { data: conn } = await admin
            .from('marketplace_connections')
            .select('id')
            .eq('user_id', user.id)
            .eq('marketplace', 'trendyol')
            .maybeSingle();
        connId = conn?.id;
    }

    if (!connId) {
        return { ctx: null, error: 'Trendyol bağlantısı bulunamadı.', status: 404 };
    }

    // Verify ownership
    const { data: connection } = await admin
        .from('marketplace_connections')
        .select('id, user_id, seller_id')
        .eq('id', connId)
        .single();

    if (!connection || connection.user_id !== user.id) {
        return { ctx: null, error: 'Bu bağlantıya erişim yetkiniz yok.', status: 403 };
    }

    // Decrypt credentials (direct admin bypasses RLS on marketplace_secrets)
    const { data: secret } = await admin
        .from('marketplace_secrets')
        .select('encrypted_blob')
        .eq('connection_id', connId)
        .single();

    if (!secret?.encrypted_blob) {
        return { ctx: null, error: 'Kimlik bilgileri bulunamadı. Lütfen API anahtarlarınızı tekrar kaydedin.', status: 404 };
    }

    const decrypted = decryptCredentials(secret.encrypted_blob);
    const sellerId = decrypted.sellerId || connection.seller_id || '';

    if (!sellerId) {
        return { ctx: null, error: 'Seller ID bulunamadı.', status: 400 };
    }

    return {
        ctx: {
            userId: user.id,
            connectionId: connId,
            sellerId,
            credentials: {
                apiKey: decrypted.apiKey,
                apiSecret: decrypted.apiSecret,
                sellerId,
            },
            admin,
        },
        error: null,
        status: 200,
    };
}

/**
 * Write a sync log entry (never include secrets in message!)
 */
export async function writeSyncLog(
    admin: any,
    connectionId: string,
    syncType: 'test' | 'products' | 'orders',
    status: 'success' | 'failed' | 'running',
    message: string,
    startedAt: string,
    finishedAt?: string
) {
    await admin.from('marketplace_sync_logs').insert({
        connection_id: connectionId,
        sync_type: syncType,
        status,
        message: message.slice(0, 500), // truncate
        started_at: startedAt,
        finished_at: finishedAt || null,
    });
}

/**
 * Lightweight context for normalize endpoints.
 * Authenticates user and finds connection but does NOT read marketplace_secrets.
 * Use this for endpoints that only work with local DB data (normalization, matching).
 */
export interface NormalizeContext {
    userId: string;
    connectionId: string;
    admin: any;
}

export async function prepareNormalizeContext(): Promise<{
    ctx: NormalizeContext | null;
    error: string | null;
    status: number;
}> {
    const supabase = createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
        return { ctx: null, error: 'Not authenticated', status: 401 };
    }

    const admin = getDirectAdmin();

    const { data: conn } = await admin
        .from('marketplace_connections')
        .select('id, user_id')
        .eq('user_id', user.id)
        .eq('marketplace', 'trendyol')
        .maybeSingle();

    if (!conn) {
        return { ctx: null, error: 'Trendyol bağlantısı bulunamadı.', status: 404 };
    }

    return {
        ctx: { userId: user.id, connectionId: conn.id, admin },
        error: null,
        status: 200,
    };
}
