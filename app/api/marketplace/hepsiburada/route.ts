import { NextResponse } from 'next/server';
import { createClient, getSupabaseAdmin } from '@/lib/supabase-server-client';
import { encryptCredentials } from '@/lib/marketplace-crypto';

export const dynamic = 'force-dynamic';

// ─── GET: Fetch Hepsiburada connection status ───
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
            .eq('marketplace', 'hepsiburada')
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
        });
    } catch (err: any) {
        console.error('[marketplace/hepsiburada GET] Error:', err?.message);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ─── POST: Save Hepsiburada credentials ───
export async function POST(req: Request) {
    let connectionId: string | null = null;

    try {
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

        if (!process.env.MARKETPLACE_SECRET_KEY) {
            return NextResponse.json(
                { error: 'Sunucu yapılandırma hatası: şifreleme anahtarı bulunamadı.', error_code: 'encryption_key_missing' },
                { status: 500 }
            );
        }
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json(
                { error: 'Sunucu yapılandırma hatası: service role key bulunamadı.', error_code: 'service_role_missing' },
                { status: 500 }
            );
        }

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
                    marketplace: 'hepsiburada',
                    status: 'connected',
                    store_name: storeName || null,
                    seller_id: sellerId || null,
                },
                { onConflict: 'user_id,marketplace' }
            )
            .select('id, status, store_name')
            .single();

        if (connErr || !connection) {
            console.error('[hepsiburada POST] Connection upsert failed:', connErr?.message);
            return NextResponse.json(
                { error: 'Bağlantı oluşturulamadı.', error_code: 'connection_upsert_failed' },
                { status: 500 }
            );
        }

        connectionId = connection.id;

        // Step 2: Encrypt credentials
        let encryptedBlob: string;
        try {
            encryptedBlob = encryptCredentials({
                apiKey,
                apiSecret,
                ...(sellerId ? { sellerId } : {}),
            });
        } catch (encErr: any) {
            console.error('[hepsiburada POST] Encryption failed:', encErr?.message);
            return NextResponse.json(
                { error: 'Kimlik bilgileri şifrelenemedi.', error_code: 'encryption_failed' },
                { status: 500 }
            );
        }

        // Step 3: Upsert secret
        const { data: existingSecret } = await adminDirect
            .from('marketplace_secrets')
            .select('id')
            .eq('connection_id', connectionId)
            .maybeSingle();

        let secretErr: any = null;

        if (existingSecret) {
            const { error } = await adminDirect
                .from('marketplace_secrets')
                .update({ encrypted_blob: encryptedBlob, key_version: 1 })
                .eq('connection_id', connectionId);
            secretErr = error;
        } else {
            const { error } = await adminDirect
                .from('marketplace_secrets')
                .insert({ connection_id: connectionId, encrypted_blob: encryptedBlob, key_version: 1 });
            secretErr = error;
        }

        if (secretErr) {
            console.error('[hepsiburada POST] Secrets write failed:', secretErr.message);
            return NextResponse.json(
                { error: 'Güvenli anahtar kaydı başarısız.', error_code: 'secrets_write_failed', secrets_saved: false },
                { status: 500 }
            );
        }

        // Step 4: Verify
        const { data: verifySecret } = await adminDirect
            .from('marketplace_secrets')
            .select('id')
            .eq('connection_id', connectionId)
            .maybeSingle();

        if (!verifySecret) {
            return NextResponse.json(
                { error: 'Güvenli anahtar kaydı doğrulanamadı.', error_code: 'secrets_verify_failed', secrets_saved: false },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            connection_id: connectionId,
            status: connection.status,
            store_name: connection.store_name,
            secrets_saved: true,
        });
    } catch (err: any) {
        console.error('[hepsiburada POST] Unexpected error:', err?.message);
        return NextResponse.json(
            { error: 'Beklenmeyen sunucu hatası.', error_code: 'unexpected_error' },
            { status: 500 }
        );
    }
}

// ─── DELETE: Disconnect Hepsiburada ───
export async function DELETE() {
    try {
        const supabase = createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const admin = getSupabaseAdmin();

        const { data: connection } = await admin
            .from('marketplace_connections')
            .select('id')
            .eq('user_id', user.id)
            .eq('marketplace', 'hepsiburada')
            .maybeSingle();

        if (!connection) {
            return NextResponse.json({ error: 'Bağlantı bulunamadı.' }, { status: 404 });
        }

        await admin.from('marketplace_secrets').delete().eq('connection_id', connection.id);
        await admin
            .from('marketplace_connections')
            .update({ status: 'disconnected', store_name: null, seller_id: null })
            .eq('id', connection.id);

        await admin.from('marketplace_sync_logs').insert({
            connection_id: connection.id,
            sync_type: 'test',
            status: 'success',
            message: 'Hepsiburada bağlantısı kaldırıldı.',
            started_at: new Date().toISOString(),
            finished_at: new Date().toISOString(),
        });

        return NextResponse.json({ success: true, status: 'disconnected' });
    } catch (err: any) {
        console.error('[marketplace/hepsiburada DELETE] Error:', err?.message);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
