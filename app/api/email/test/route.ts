import { NextResponse } from 'next/server';

// Force dynamic — never evaluate at build time
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        // 0. Block in production (debug-only route)
        if (process.env.VERCEL_ENV === 'production') {
            return NextResponse.json({ error: 'Bu endpoint production ortamında devre dışıdır.' }, { status: 404 });
        }

        // 1. Safe env guards — return 500, never throw
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            return NextResponse.json({ error: 'Supabase URL veya Anon Key eksik. Sunucu yapılandırmasını kontrol edin.' }, { status: 500 });
        }
        if (!process.env.RESEND_API_KEY) {
            return NextResponse.json({ error: 'RESEND_API_KEY bulunamadı. Sunucu yapılandırması eksik.' }, { status: 500 });
        }
        if (!process.env.MAIL_FROM) {
            return NextResponse.json({ error: 'MAIL_FROM bulunamadı. Lütfen e-posta gönderen adresini ayarlayın.' }, { status: 500 });
        }

        // 2. Lazy imports — only after env is confirmed present
        const { createClient } = await import('@/lib/supabase-server-client');
        const { emailService } = await import('@/lib/email/emailService');
        const { getTestEmailTemplate } = await import('@/lib/email/templates');

        // 3. Auth Check: cookie-based client for App Router
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user || !user.email) {
            console.error('[Auth Error] User not found or session invalid:', authError);
            return NextResponse.json({ error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
        }

        const { template } = await req.json();

        if (template !== 'test_email') {
            return NextResponse.json({ error: 'Geçersiz şablon türü.' }, { status: 400 });
        }

        // 4. Generate Template
        const { subject, html, text } = getTestEmailTemplate(user.email);

        // 5. Send Email
        const result = await emailService.sendEmail({
            to: user.email,
            subject,
            html,
            text,
            templateName: 'test_email',
            userId: user.id
        });

        return NextResponse.json({
            ok: true,
            message: 'Test e-postası başarıyla gönderildi.',
            provider_message_id: result.provider_message_id
        });

    } catch (error: any) {
        console.error('[POST /api/email/test] Error:', error);

        let errorMessage = 'E-posta gönderilirken bir hata oluştu.';

        if (error?.message?.includes('Resend Error')) {
            errorMessage = `Resend Hatası: ${error.message}`;
        }

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
