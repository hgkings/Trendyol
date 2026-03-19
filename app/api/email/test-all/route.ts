import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email/emailService';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.xn--krnet-3qa.com';

/**
 * Tüm email template'lerini test eder.
 * POST /api/email/test-all
 * Body: { email: "test@example.com" }
 * Authorization: Bearer CRON_SECRET
 */
export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await request.json();
    if (!email) {
        return NextResponse.json({ error: 'email required' }, { status: 400 });
    }

    const testUser = { email, name: 'Test Kullanıcı', id: 'test-user-id' };
    const results: Record<string, string> = {};

    // 1. Welcome
    try {
        await emailService.sendWelcomeEmail(testUser);
        results.welcome = '✅';
    } catch (err: any) {
        results.welcome = `❌ ${err.message}`;
    }

    // 2. Email Verify
    try {
        await emailService.sendEmailVerification(testUser, `${APP_URL}/auth/callback?code=test-verify`);
        results.emailVerify = '✅';
    } catch (err: any) {
        results.emailVerify = `❌ ${err.message}`;
    }

    // 3. Password Reset
    try {
        await emailService.sendPasswordReset(testUser, `${APP_URL}/auth/reset-password?token=test-reset`);
        results.passwordReset = '✅';
    } catch (err: any) {
        results.passwordReset = `❌ ${err.message}`;
    }

    // 4. Pro Activated
    try {
        await emailService.sendProActivated(testUser, { planType: 'pro_monthly', expiresAt: '19.04.2026' });
        results.proActivated = '✅';
    } catch (err: any) {
        results.proActivated = `❌ ${err.message}`;
    }

    // 5. Pro Expiry Warning (7 gün)
    try {
        await emailService.sendProExpiryWarning(testUser, { daysLeft: 7, expiresAt: '26.03.2026' });
        results.proExpiryWarning7 = '✅';
    } catch (err: any) {
        results.proExpiryWarning7 = `❌ ${err.message}`;
    }

    // 6. Pro Expiry Warning (1 gün)
    try {
        await emailService.sendProExpiryWarning(testUser, { daysLeft: 1, expiresAt: '20.03.2026' });
        results.proExpiryWarning1 = '✅';
    } catch (err: any) {
        results.proExpiryWarning1 = `❌ ${err.message}`;
    }

    // 7. Pro Expired
    try {
        await emailService.sendProExpired(testUser);
        results.proExpired = '✅';
    } catch (err: any) {
        results.proExpired = `❌ ${err.message}`;
    }

    return NextResponse.json({ success: true, results });
}
