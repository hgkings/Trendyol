
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server-client';
import { sendEmail } from '@/lib/notification-service';
import { getTestEmailTemplate } from '@/lib/email-templates';

export async function POST(req: NextRequest) {
    const supabase = createClient();

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        console.error('Test Email Auth Error:', error);
        // Fallback: Try getSession if getUser fails (sometimes useful for debugging, though less secure for sensitive data)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            console.error('Test Email Session Error:', sessionError);
            return NextResponse.json({ error: 'Unauthorized', details: error?.message || sessionError?.message }, { status: 401 });
        }
        // If session exists but getUser failed, we might use session.user (with caution)
        console.warn('getUser failed but getSession succeeded. Using session user.');
        return handleEmailSending(req, session.user);
    }

    return handleEmailSending(req, user);
}

async function handleEmailSending(req: NextRequest, user: any) {
    const supabase = createClient();

    // Check user preference
    const { data: profile } = await supabase
        .from('profiles')
        .select('email_notifications_enabled')
        .eq('id', user.id)
        .single();

    // If no profile found, assume true (default) but check error
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
