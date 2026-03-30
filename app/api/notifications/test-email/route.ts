import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendNotificationEmail as sendEmail } from '@/lib/notification-service'
import { getTestEmailTemplate } from '@/lib/email-templates'

// Prevent static evaluation at build time
export const dynamic = 'force-dynamic'

// TODO: callGatewayV1Format ile değiştirilecek
export async function POST(req: NextRequest) {
  // Block in production — debug-only endpoint
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Bu endpoint production ortamında devre dışıdır.' }, { status: 404 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Supabase URL veya Anon Key eksik.' }, { status: 500 })
  }

  const supabase = createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized', details: error?.message }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email_notifications_enabled')
    .eq('id', user.id)
    .single()

  const enabled = profile ? profile.email_notifications_enabled !== false : true

  if (!enabled) {
    return NextResponse.json({ error: 'Notifications disabled' }, { status: 403 })
  }

  const to = user.email || ''
  if (!to) {
    return NextResponse.json({ error: 'No email found' }, { status: 400 })
  }

  const { success, error: sendError } = await sendEmail({
    to,
    subject: 'Kar Kocu - Test Bildirimi',
    html: getTestEmailTemplate()
  })

  if (!success) {
    return NextResponse.json({ error: sendError }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
