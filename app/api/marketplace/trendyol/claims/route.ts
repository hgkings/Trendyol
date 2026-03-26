import { NextRequest, NextResponse } from 'next/server';
import { prepareSyncContext } from '@/lib/marketplace-sync-helpers';
import { fetchAllClaims } from '@/lib/trendyol-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { ctx, error, status } = await prepareSyncContext();
        if (!ctx) {
            return NextResponse.json({ error }, { status });
        }

        const { searchParams } = new URL(request.url);
        const gun = Number(searchParams.get('gun') ?? '30');

        const bugun = new Date();
        const baslangic = new Date();
        baslangic.setDate(bugun.getDate() - gun);

        const iadeler = await fetchAllClaims(ctx.credentials, baslangic, bugun);

        const toplamIadeSayisi = iadeler.length;
        const toplamIadeTutari = iadeler.reduce((acc, iade) => {
            return acc + iade.lines.reduce((s, l) => s + (l.amount * l.quantity), 0);
        }, 0);

        const nedenDagilimi: Record<string, number> = {};
        iadeler.forEach(iade => {
            iade.lines.forEach(line => {
                const neden = line.claimReason || 'Diğer';
                nedenDagilimi[neden] = (nedenDagilimi[neden] || 0) + 1;
            });
        });

        const formatlanmis = iadeler.map(iade => ({
            iadeId: iade.claimId,
            siparisNo: iade.orderNumber,
            iadeTarihi: iade.claimDate,
            iadeTipi: iade.claimType,
            iadeDurumu: iade.status,
            urunler: iade.lines.map(line => ({
                urunAdi: line.productName,
                barkod: line.barcode,
                adet: line.quantity,
                fiyat: line.amount,
                neden: line.claimReason,
            })),
            toplamTutar: iade.totalAmount,
        }));

        return NextResponse.json({
            success: true,
            data: formatlanmis,
            ozet: {
                toplamIadeSayisi,
                toplamIadeTutari,
                nedenDagilimi,
            },
            aralik: `Son ${gun} gün`,
        });
    } catch (err: any) {
        console.error('[marketplace/trendyol/claims] Error:', err?.message);
        return NextResponse.json(
            { error: err?.message || 'İade verileri alınamadı.' },
            { status: 500 }
        );
    }
}
