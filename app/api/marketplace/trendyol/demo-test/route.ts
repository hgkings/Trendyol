import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Demo mode has been removed. This endpoint is disabled.
export async function POST() {
    return NextResponse.json(
        { ok: false, error_code: 'demo_disabled', message: 'Demo modu kaldırıldı. Gerçek API bilgilerinizi girerek bağlanın.' },
        { status: 410 }
    );
}
