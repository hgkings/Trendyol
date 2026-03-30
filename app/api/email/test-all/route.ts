import { NextRequest, NextResponse } from 'next/server'
import { requireCronSecret } from '@/lib/api/helpers'
import { emailService } from '@/lib/email/emailService'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.xn--krnet-3qa.com'

/**
 * Tüm email template'lerini test eder.
 * POST /api/email/test-all
 * Body: { email: "test@example.com" }
 * Authorization: Bearer CRON_SECRET
 */
export async function POST(request: NextRequest) {
  const cronCheck = requireCronSecret(request)
  if (cronCheck !== true) return cronCheck

  const { email } = await request.json()
  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }

  const testUser = { email, name: 'Test Kullanıcı', id: 'test-user-id' }
  const results: Record<string, string> = {}

  // 1. Welcome
  try {
    await emailService.sendWelcomeEmail(testUser)
    results.welcome = '✅'
  } catch (err) {
    results.welcome = `❌ ${err instanceof Error ? err.message : 'Hata'}`
  }

  // 2. Email Verify
  try {
    await emailService.sendEmailVerification(testUser, `${APP_URL}/auth/callback?code=test-verify`)
    results.emailVerify = '✅'
  } catch (err) {
    results.emailVerify = `❌ ${err instanceof Error ? err.message : 'Hata'}`
  }

  // 3. Password Reset
  try {
    await emailService.sendPasswordReset(testUser, `${APP_URL}/auth/reset-password?token=test-reset`)
    results.passwordReset = '✅'
  } catch (err) {
    results.passwordReset = `❌ ${err instanceof Error ? err.message : 'Hata'}`
  }

  // 4. Pro Activated
  try {
    await emailService.sendProActivated(testUser, { planType: 'pro_monthly', expiresAt: '19.04.2026' })
    results.proActivated = '✅'
  } catch (err) {
    results.proActivated = `❌ ${err instanceof Error ? err.message : 'Hata'}`
  }

  // 5. Pro Expiry Warning (7 gün)
  try {
    await emailService.sendProExpiryWarning(testUser, { daysLeft: 7, expiresAt: '26.03.2026' })
    results.proExpiryWarning7 = '✅'
  } catch (err) {
    results.proExpiryWarning7 = `❌ ${err instanceof Error ? err.message : 'Hata'}`
  }

  // 6. Pro Expiry Warning (1 gün)
  try {
    await emailService.sendProExpiryWarning(testUser, { daysLeft: 1, expiresAt: '20.03.2026' })
    results.proExpiryWarning1 = '✅'
  } catch (err) {
    results.proExpiryWarning1 = `❌ ${err instanceof Error ? err.message : 'Hata'}`
  }

  // 7. Pro Expired
  try {
    await emailService.sendProExpired(testUser)
    results.proExpired = '✅'
  } catch (err) {
    results.proExpired = `❌ ${err instanceof Error ? err.message : 'Hata'}`
  }

  return NextResponse.json({ success: true, results })
}
