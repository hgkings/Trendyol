import { NextResponse } from 'next/server'
import { requireAuth, errorResponse } from '@/lib/api/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('cash_plan')
      .select('*')
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Nakit planı yüklenemedi' }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const rows = await request.json()

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Geçerli satır verisi gerekli' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from('cash_plan').upsert(
      rows.map((r: Record<string, unknown>) => ({
        user_id: user.id,
        month: r.month,
        opening_cash: r.opening_cash,
        cash_in: r.cash_in,
        cash_out: r.cash_out,
        closing_cash: r.closing_cash,
      })),
      { onConflict: 'user_id, month' }
    )

    if (error) {
      return NextResponse.json({ error: 'Kaydetme hatası: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
