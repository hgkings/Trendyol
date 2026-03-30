import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/smtp'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { getIp } from '@/lib/api/helpers'

export const dynamic = 'force-dynamic'

async function handler(request: Request) {
  const ip = getIp(request)
  const rateLimitResult = await checkRateLimit('email', ip)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Çok fazla istek. Lütfen bekleyin.' },
      { status: 429 }
    )
  }

  const result = await sendEmail({
    to: 'isbilirhilmi8@gmail.com',
    subject: '✅ Kârnet Brevo SMTP Test',
    html: `
      <h2>✅ Brevo SMTP Çalışıyor!</h2>
      <p>Tarih: ${new Date().toLocaleString('tr-TR')}</p>
    `,
  })
  return NextResponse.json(result)
}

export async function GET(request: NextRequest) {
  return handler(request)
}

export async function POST(request: NextRequest) {
  return handler(request)
}
