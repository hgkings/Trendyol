import { NextResponse } from 'next/server';
import { createClient, getSupabaseAdmin } from '@/lib/supabase-server-client';
import { encryptCredentials } from '@/lib/marketplace-crypto';

export const dynamic = 'force-dynamic';

// ─── GET: Fetch connection status (no secrets returned) ───
export async function GET() {
    try {
        const supabase = createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { data: connection } = await supabase
            .from('marketplace_connections')
            .select('id, marketplace, status, store_name, seller_id, last_sync_at, created_at, webhook_active')
            .eq('user_id', user.id)
            .eq('marketplace', 'trendyol')
            .maybeSingle();

        if (!connection) {
            return NextResponse.json({ connected: false, status: 'disconnected' });
        }

        return NextResponse.json({
            connected: connection.status === 'connected',
            connection_id: connection.id,
            status: connection.status,
            store_name: connection.store_name,
            seller_id: connection.seller_id,
            last_sync_at: connection.last_sync_at,
            webhook_active: connection.webhook_active ?? false,
        });
    } catch (err: any) {
        console.error('[marketplace/trendyol GET] Error:', err?.message);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ─── POST: Save credentials (encrypt & store) ───
export async function POST(req: Request) {
    let connectionId: string | null = null;

    try {
        // A) User auth via SSR client (JWT)
        const supabase = createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await req.json();
        const { apiKey, apiSecret, sellerId, storeName } = body;

        if (!apiKey || !apiSecret) {
            return NextResponse.json(
                { error: 'API Key ve API Secret zorunludur.' },
                { status: 400 }
            );
        }

        // Check env vars
        if (!process.env.MARKETPLACE_SECRET_KEY) {
            console.error('[trendyol POST] MARKETPLACE_SECRET_KEY is NOT SET');
            return NextResponse.json(
                { error: 'Sunucu yapılandırma hatası: şifreleme anahtarı bulunamadı.', error_code: 'encryption_key_missing' },
                { status: 500 }
            );
        }
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('[trendyol POST] SUPABASE_SERVICE_ROLE_KEY is NOT SET');
            return NextResponse.json(
                { error: 'Sunucu yapılandırma hatası: service role key bulunamadı.', error_code: 'service_role_missing' },
                { status: 500 }
            );
        }

        // B) Create a DIRECT admin client using @supabase/supabase-js (NOT SSR)
        //    This guarantees RLS bypass for marketplace_secrets which has zero client policies.
        const { createClient: createDirectClient } = await import('@supabase/supabase-js');
        const adminDirect = createDirectClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Step 1: Upsert marketplace_connections
        const { data: connection, error: connErr } = await adminDirect
            .from('marketplace_connections')
            .upsert(
                {
                    user_id: user.id,
                    marketplace: 'trendyol',
                    status: 'connected',
                    store_name: storeName || null,
                    seller_id: sellerId || null,
                },
                { onConflict: 'user_id,marketplace' }
            )
            .select('id, status, store_name')
            .single();

        if (connErr || !connection) {
            console.error('[trendyol POST] Step 1 FAILED — connection upsert:', connErr?.message, connErr?.code);
            await logStep(adminDirect, null, 'connections_upserted', 'failed', `Connection upsert error: ${connErr?.message || 'no data'}`);
            return NextResponse.json(
                { error: 'Bağlantı oluşturulamadı.', error_code: 'connection_upsert_failed', details: connErr?.message },
                { status: 500 }
            );
        }

        connectionId = connection.id;
        await logStep(adminDirect, connectionId, 'connections_upserted', 'success', `Connection OK: ${connectionId}`);

        // Step 2: Encrypt credentials
        let encryptedBlob: string;
        try {
            encryptedBlob = encryptCredentials({
                apiKey,
                apiSecret,
                ...(sellerId ? { sellerId } : {}),
            });
        } catch (encErr: any) {
            console.error('[trendyol POST] Step 2 FAILED — encryption:', encErr?.message);
            await logStep(adminDirect, connectionId, 'secrets_saved', 'failed', `Encryption error: ${encErr?.message}`);
            return NextResponse.json(
                { error: 'Kimlik bilgileri şifrelenemedi.', error_code: 'encryption_failed' },
                { status: 500 }
            );
        }

        // Step 3: Check if secret row already exists
        const { data: existingSecret } = await adminDirect
            .from('marketplace_secrets')
            .select('id')
            .eq('connection_id', connectionId)
            .maybeSingle();

        let secretErr: any = null;

        if (existingSecret) {
            // UPDATE existing row
            const { error } = await adminDirect
                .from('marketplace_secrets')
                .update({
                    encrypted_blob: encryptedBlob,
                    key_version: 1,
                })
                .eq('connection_id', connectionId);
            secretErr = error;
        } else {
            // INSERT new row
            const { error } = await adminDirect
                .from('marketplace_secrets')
                .insert({
                    connection_id: connectionId,
                    encrypted_blob: encryptedBlob,
                    key_version: 1,
                });
            secretErr = error;
        }

        if (secretErr) {
            console.error('[trendyol POST] Step 3 FAILED — secrets write:', secretErr.message, 'code:', secretErr.code, 'details:', secretErr.details);
            await logStep(adminDirect, connectionId, 'secrets_saved', 'failed', `Secrets write error: ${secretErr.message} (code: ${secretErr.code})`);
            return NextResponse.json(
                {
                    error: 'Güvenli anahtar kaydı başarısız.',
                    error_code: 'secrets_write_failed',
                    secrets_saved: false,
                    debug: { pg_code: secretErr.code, pg_message: secretErr.message },
                },
                { status: 500 }
            );
        }

        // Step 4: Verify the secret row exists
        const { data: verifySecret, error: verifyErr } = await adminDirect
            .from('marketplace_secrets')
            .select('id, connection_id')
            .eq('connection_id', connectionId)
            .maybeSingle();

        if (!verifySecret) {
            console.error('[trendyol POST] Step 4 FAILED — verification:', verifyErr?.message);
            await logStep(adminDirect, connectionId, 'secrets_saved', 'failed', `Verify failed: row not found after write. verifyErr: ${verifyErr?.message || 'none'}`);
            return NextResponse.json(
                { error: 'Güvenli anahtar kaydı doğrulanamadı.', error_code: 'secrets_verify_failed', secrets_saved: false },
                { status: 500 }
            );
        }

        await logStep(adminDirect, connectionId, 'secrets_saved', 'success', `Secret saved OK, secret_id: ${verifySecret.id}`);

        return NextResponse.json({
            success: true,
            connection_id: connectionId,
            status: connection.status,
            store_name: connection.store_name,
            secrets_saved: true,
        });
    } catch (err: any) {
        console.error('[trendyol POST] Unexpected error:', err?.message, err?.stack);
        return NextResponse.json(
            { error: 'Beklenmeyen sunucu hatası.', error_code: 'unexpected_error', details: err?.message },
            { status: 500 }
        );
    }
}

/** Write a step-level debug log entry (no secrets!) */
async function logStep(admin: any, connectionId: string | null, step: string, status: string, message: string) {
    try {
        if (!connectionId) return;
        await admin.from('marketplace_sync_logs').insert({
            connection_id: connectionId,
            sync_type: 'test',
            status: status === 'success' ? 'success' : 'failed',
            message: `[${step}] ${message}`,
            started_at: new Date().toISOString(),
            finished_at: new Date().toISOString(),
        });
    } catch {
        // Never let logging break the main flow
    }
}

// ─── DELETE: Disconnect (remove secrets, update status) ───
export async function DELETE() {
    try {
        const supabase = createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const admin = getSupabaseAdmin();

        // Find the connection
        const { data: connection } = await admin
            .from('marketplace_connections')
            .select('id')
            .eq('user_id', user.id)
            .eq('marketplace', 'trendyol')
            .maybeSingle();

        if (!connection) {
            return NextResponse.json({ error: 'Bağlantı bulunamadı.' }, { status: 404 });
        }

        // Delete secrets first (cascade would handle it, but be explicit)
        await admin
            .from('marketplace_secrets')
            .delete()
            .eq('connection_id', connection.id);

        // Update status to disconnected
        await admin
            .from('marketplace_connections')
            .update({ status: 'disconnected', store_name: null, seller_id: null })
            .eq('id', connection.id);

        // Log disconnection
        await admin.from('marketplace_sync_logs').insert({
            connection_id: connection.id,
            sync_type: 'test',
            status: 'success',
            message: 'Trendyol bağlantısı kaldırıldı.',
            started_at: new Date().toISOString(),
            finished_at: new Date().toISOString(),
        });

        return NextResponse.json({ success: true, status: 'disconnected' });
    } catch (err: any) {
        console.error('[marketplace/trendyol DELETE] Error:', err?.message);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
