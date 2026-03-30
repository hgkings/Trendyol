import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const paymentId = searchParams.get('paymentId');

        if (!paymentId) {
            return NextResponse.json({ error: 'paymentId gerekli' }, { status: 400 });
        }

        const supabase = createAdminClient();

        // Ödeme kaydını bul
        const { data: payment } = await supabase
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .single();

        if (!payment) {
            return NextResponse.json({ error: 'Ödeme bulunamadı' }, { status: 404 });
        }

        // Zaten ödenmiş mi?
        if (payment.status === 'paid') {
            return NextResponse.json({ isPro: true, source: 'db' });
        }

        // PayTR Link API durum-sorgu Link API callback_id'lerini desteklemiyor.
        // Pro aktivasyonu yalnızca callback route üzerinden gerçekleşir.
        return NextResponse.json({ isPro: false, paymentStatus: payment.status });

    } catch {
        return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 });
    }
}
