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
            .select('id, marketplace, status, store_name, seller_id, last_sync_at, created_at')
            .eq('user_id', user.id)
            .eq('marketplace', 'trendyol')
            .maybeSingle();

        if (!connection) {
            return NextResponse.json({ connected: false, status: 'disconnected' });
        }

        return NextResponse.json({
            connected: connection.status === 'connected' || connection.status === 'connected_demo',
            connection_id: connection.id,
            status: connection.status,
            store_name: connection.store_name,
            seller_id: connection.seller_id,
            last_sync_at: connection.last_sync_at,
        });
    } catch (err: any) {
        console.error('[marketplace/trendyol GET] Error:', err?.message);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ─── POST: Save credentials (encrypt & store) ───
export async function POST(req: Request) {
    try {
        const supabase = createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await req.json();
        const { apiKey, apiSecret, sellerId, storeName } = body;

        // Validate required fields
        if (!apiKey || !apiSecret) {
            return NextResponse.json(
                { error: 'API Key ve API Secret zorunludur.' },
                { status: 400 }
            );
        }

        // Check encryption key availability BEFORE doing anything
        if (!process.env.MARKETPLACE_SECRET_KEY) {
            console.error('[marketplace/trendyol POST] MARKETPLACE_SECRET_KEY env variable is not set!');
            return NextResponse.json(
                { error: 'Sunucu yapılandırma hatası: şifreleme anahtarı bulunamadı.', error_code: 'encryption_key_missing' },
                { status: 500 }
            );
        }

        const admin = getSupabaseAdmin();

        // 1) Upsert marketplace_connections
        const { data: connection, error: connErr } = await admin
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
            console.error('[marketplace/trendyol POST] Connection upsert failed:', connErr?.message);
            return NextResponse.json(
                { error: 'Bağlantı oluşturulamadı.', error_code: 'connection_upsert_failed' },
                { status: 500 }
            );
        }

        // 2) Encrypt credentials (NEVER log the plaintext!)
        let encryptedBlob: string;
        try {
            encryptedBlob = encryptCredentials({
                apiKey,
                apiSecret,
                ...(sellerId ? { sellerId } : {}),
            });
        } catch (encErr: any) {
            console.error('[marketplace/trendyol POST] Encryption failed:', encErr?.message);
            return NextResponse.json(
                { error: 'Kimlik bilgileri şifrelenemedi.', error_code: 'encryption_failed' },
                { status: 500 }
            );
        }

        // 3) Upsert marketplace_secrets via service role
        const { error: secretErr } = await admin
            .from('marketplace_secrets')
            .upsert(
                {
                    connection_id: connection.id,
                    encrypted_blob: encryptedBlob,
                    key_version: 1,
                },
                { onConflict: 'connection_id' }
            );

        if (secretErr) {
            console.error('[marketplace/trendyol POST] Secrets upsert error:', secretErr.message, 'code:', secretErr.code);
            return NextResponse.json(
                { error: 'Güvenli anahtar kaydı başarısız.', error_code: 'secrets_write_failed', secrets_saved: false },
                { status: 500 }
            );
        }

        // 4) Verify the secret was actually written
        const { data: verifySecret } = await admin
            .from('marketplace_secrets')
            .select('id')
            .eq('connection_id', connection.id)
            .maybeSingle();

        const secretsSaved = !!verifySecret;

        if (!secretsSaved) {
            console.error('[marketplace/trendyol POST] Secret verification failed — row not found after upsert');
            return NextResponse.json(
                { error: 'Güvenli anahtar kaydı doğrulanamadı.', error_code: 'secrets_verify_failed', secrets_saved: false },
                { status: 500 }
            );
        }

        // 5) Log the save event (no secrets in message!)
        await admin.from('marketplace_sync_logs').insert({
            connection_id: connection.id,
            sync_type: 'test',
            status: 'success',
            message: 'Trendyol bağlantı bilgileri kaydedildi ve doğrulandı.',
            started_at: new Date().toISOString(),
            finished_at: new Date().toISOString(),
        });

        return NextResponse.json({
            success: true,
            connection_id: connection.id,
            status: connection.status,
            store_name: connection.store_name,
            secrets_saved: true,
        });
    } catch (err: any) {
        console.error('[marketplace/trendyol POST] Unexpected error:', err?.message);
        return NextResponse.json(
            { error: 'Beklenmeyen sunucu hatası.', error_code: 'unexpected_error' },
            { status: 500 }
        );
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
