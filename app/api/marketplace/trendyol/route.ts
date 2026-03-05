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
            console.error('[marketplace/trendyol POST] Connection upsert error:', connErr?.message);
            return NextResponse.json({ error: 'Bağlantı oluşturulamadı.' }, { status: 500 });
        }

        // 2) Encrypt credentials (NEVER log the plaintext!)
        const encryptedBlob = encryptCredentials({
            apiKey,
            apiSecret,
            ...(sellerId ? { sellerId } : {}),
        });

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
            console.error('[marketplace/trendyol POST] Secret upsert error:', secretErr?.message);
            return NextResponse.json({ error: 'Kimlik bilgileri kaydedilemedi.' }, { status: 500 });
        }

        // 4) Log the save event (no secrets in message!)
        await admin.from('marketplace_sync_logs').insert({
            connection_id: connection.id,
            sync_type: 'test',
            status: 'success',
            message: 'Trendyol bağlantı bilgileri kaydedildi.',
            started_at: new Date().toISOString(),
            finished_at: new Date().toISOString(),
        });

        return NextResponse.json({
            success: true,
            connection_id: connection.id,
            status: connection.status,
            store_name: connection.store_name,
        });
    } catch (err: any) {
        console.error('[marketplace/trendyol POST] Error:', err?.message);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
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
