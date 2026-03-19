import { type NextRequest, NextResponse } from 'next/server';

// Prevent static evaluation at build time
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    // Block in production — debug-only endpoint
    if (process.env.VERCEL_ENV === 'production') {
        return NextResponse.json({ error: 'Bu endpoint production ortamında devre dışıdır.' }, { status: 404 });
    }

    // Safe env guard — return 500, never throw
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        return NextResponse.json({ error: 'Supabase URL veya Anon Key eksik.' }, { status: 500 });
    }

    // Lazy imports — only after env is confirmed present
    const { createClient } = await import('@/lib/supabase-server-client');
    const { sendNotificationEmail: sendEmail } = await import('@/lib/notification-service');
    const { getTestEmailTemplate } = await import('@/lib/email-templates');

    const supabase = createClient();

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            return NextResponse.json({ error: 'Unauthorized', details: error?.message || sessionError?.message }, { status: 401 });
        }
        return handleEmailSending(session.user, createClient, sendEmail, getTestEmailTemplate);
    }

    return handleEmailSending(user, createClient, sendEmail, getTestEmailTemplate);
}

async function handleEmailSending(
    user: any,
    createClient: any,
    sendEmail: any,
    getTestEmailTemplate: any
) {
    const supabase = createClient();

    const { data: profile } = await supabase
        .from('profiles')
        .select('email_notifications_enabled')
        .eq('id', user.id)
        .single();

    const enabled = profile ? profile.email_notifications_enabled !== false : true;

    if (!enabled) {
        return NextResponse.json({ error: 'Notifications disabled' }, { status: 403 });
    }

    const to = user.email || '';
    if (!to) {
        return NextResponse.json({ error: 'No email found' }, { status: 400 });
    }

    const { success, error } = await sendEmail({
        to,
        subject: 'Kar Kocu - Test Bildirimi',
        html: getTestEmailTemplate()
    });

    if (!success) {
        return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
