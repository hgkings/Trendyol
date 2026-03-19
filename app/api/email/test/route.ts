import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/smtp'

export const dynamic = 'force-dynamic'

async function handler() {
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

export async function GET() {
  return handler()
}

export async function POST() {
  return handler()
}
