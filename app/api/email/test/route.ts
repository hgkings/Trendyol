import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/smtp'
import { requireAdmin, errorResponse } from '@/lib/api/helpers'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { getIp } from '@/lib/api/helpers'

export const dynamic = 'force-dynamic'

async function handler(request: Request) {
  try {
    // Sadece admin erisebilir
    const auth = await requireAdmin()
    if (auth instanceof Response) return auth

    const ip = getIp(request)
    const rateLimitResult = await checkRateLimit('email', ip)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Çok fazla istek. Lütfen bekleyin.' },
        { status: 429 }
      )
    }

    const result = await sendEmail({
      to: auth.email ?? '',
      subject: 'Kârnet — SMTP Test Bildirimi',
      html: `
        <h2>SMTP Çalışıyor</h2>
        <p>Tarih: ${new Date().toLocaleString('tr-TR')}</p>
      `,
    })
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function GET(request: NextRequest) {
  return handler(request)
}

export async function POST(request: NextRequest) {
  return handler(request)
}
