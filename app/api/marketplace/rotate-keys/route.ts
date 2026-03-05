import { NextResponse } from 'next/server';
import { createClient, getSupabaseAdmin } from '@/lib/supabase-server-client';
import { decryptCredentials, encryptCredentials } from '@/lib/marketplace-crypto';

export const dynamic = 'force-dynamic';

/**
 * Key rotation endpoint — Admin only.
 * Re-encrypts all marketplace_secrets with the current MARKETPLACE_SECRET_KEY.
 * Use when rotating the encryption key:
 *   1. Set new MARKETPLACE_SECRET_KEY env var
 *   2. Keep old key temporarily as MARKETPLACE_SECRET_KEY_OLD
 *   3. Call this endpoint to re-encrypt
 *   4. Remove MARKETPLACE_SECRET_KEY_OLD
 */
export async function POST() {
    try {
        // Auth: only admin users
        const supabase = createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Check admin status
        const admin = getSupabaseAdmin();
        const { data: profile } = await admin
            .from('profiles')
            .select('plan')
            .eq('id', user.id)
            .single();

        if (profile?.plan !== 'admin') {
            return NextResponse.json({ error: 'Admin yetkisi gerekli.' }, { status: 403 });
        }

        // Get all secrets
        const { data: secrets } = await admin
            .from('marketplace_secrets')
            .select('id, connection_id, encrypted_blob, key_version');

        if (!secrets || secrets.length === 0) {
            return NextResponse.json({ message: 'No secrets to rotate', rotated: 0 });
        }

        let rotated = 0;
        const errors: string[] = [];

        for (const secret of secrets) {
            try {
                // Decrypt with current key
                const plaintext = decryptCredentials(secret.encrypted_blob);

                // Re-encrypt with (possibly new) key
                const newBlob = encryptCredentials(plaintext);
                const newVersion = (secret.key_version || 1) + 1;

                await admin
                    .from('marketplace_secrets')
                    .update({
                        encrypted_blob: newBlob,
                        key_version: newVersion,
                    })
                    .eq('id', secret.id);

                rotated++;
            } catch (err: any) {
                errors.push(`Secret ${secret.id}: ${err?.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            rotated,
            total: secrets.length,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (err: any) {
        console.error('[marketplace/rotate-keys] Error:', err?.message);
        return NextResponse.json({ error: 'Key rotation başarısız.' }, { status: 500 });
    }
}
