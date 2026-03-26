import { NextResponse } from 'next/server';
import { prepareSyncContext } from '@/lib/marketplace-sync-helpers';
import { fetchAskidakiSiparisler } from '@/lib/trendyol-api';

export const dynamic = 'force-dynamic';

export async function GET() {
    const { ctx, error, status } = await prepareSyncContext();
    if (!ctx) return NextResponse.json({ error }, { status });

    try {
        const siparisler = await fetchAskidakiSiparisler(ctx.credentials);

        return NextResponse.json({
            success: true,
            data: siparisler,
            toplam: siparisler.length,
            uyari:
                siparisler.length > 0
                    ? `${siparisler.length} sipariş tedarik edilemedi durumunda!`
                    : null,
        });
    } catch (err: any) {
        console.error('[trendyol/unsupplied-orders] Hata:', err?.message);
        return NextResponse.json(
            { error: err?.message || 'Askıdaki siparişler alınamadı.' },
            { status: 500 }
        );
    }
}
