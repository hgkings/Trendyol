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
      .select('month, closing_cash')
      .eq('user_id', user.id)
      .lt('closing_cash', 0)

    if (error) {
      return NextResponse.json({ negativeMonths: 0 })
    }

    return NextResponse.json({ negativeMonths: data?.length ?? 0 })
  } catch (error) {
    return errorResponse(error)
  }
}
