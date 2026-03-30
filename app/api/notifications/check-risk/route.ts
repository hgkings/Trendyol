import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendNotificationEmail as sendEmail } from '@/lib/notification-service'
import { getRiskAlertTemplate } from '@/lib/email-templates'

// TODO: callGatewayV1Format ile değiştirilecek
export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { analysisId } = body

  if (!analysisId) {
    return NextResponse.json({ error: 'Missing analysisId' }, { status: 400 })
  }

  const [analysisRes, profileRes] = await Promise.all([
    supabase.from('analyses').select('*').eq('id', analysisId).eq('user_id', user.id).single(),
    supabase.from('profiles').select('email_notifications_enabled, last_notification_sent_at').eq('id', user.id).single()
  ])

  const analysis = analysisRes.data
  const profile = profileRes.data

  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }

  const score = (analysis.risk_score as number) || 0
  const level = (analysis.risk_level as string) || 'Safe'
  const isCritical = score >= 70 || level === 'High' || level === 'Critical' || level === 'Tehlikeli'

  if (!isCritical) {
    return NextResponse.json({ skipped: true, reason: 'Not critical' })
  }

  if (profile && profile.email_notifications_enabled === false) {
    return NextResponse.json({ skipped: true, reason: 'Notifications disabled' })
  }

  if (profile?.last_notification_sent_at) {
    const lastSent = new Date(profile.last_notification_sent_at)
    const now = new Date()
    const diffMs = now.getTime() - lastSent.getTime()
    const hours = diffMs / (1000 * 60 * 60)

    if (hours < 6) {
      return NextResponse.json({ skipped: true, reason: 'Cooldown active', hoursLeft: 6 - hours })
    }
  }

  const to = user.email || ''
  if (!to) return NextResponse.json({ error: 'No email user' }, { status: 400 })

  const { success, error } = await sendEmail({
    to,
    subject: `Kritik Risk: ${analysis.product_name}`,
    html: getRiskAlertTemplate(analysis.product_name as string, score, level, analysis.id as string)
  })

  if (!success) {
    return NextResponse.json({ error: 'Email gönderilemedi' }, { status: 500 })
  }

  await supabase.from('profiles').update({ last_notification_sent_at: new Date().toISOString() }).eq('id', user.id)

  return NextResponse.json({ success: true, sent: true })
}
