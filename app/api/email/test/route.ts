import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/smtp'

export const dynamic = 'force-dynamic'

export async function POST() {
  const result = await sendEmail({
    to: 'isbilirhilmi8@gmail.com',
    subject: '✅ Kârnet Brevo SMTP Test',
    html: `
      <div style="font-family: sans-serif;
                  max-width: 480px;
                  margin: 0 auto;
                  padding: 32px;">
        <h2 style="color: #4f46e5;">
          ✅ Brevo SMTP Çalışıyor!
        </h2>
        <p>Kârnet e-posta sistemi
           başarıyla Brevo'ya geçirildi.</p>
        <p style="color: #6b7280;
                  font-size: 14px;">
          Tarih: ${new Date().toLocaleString('tr-TR')}
        </p>
      </div>
    `,
  })
  return NextResponse.json(result)
}
