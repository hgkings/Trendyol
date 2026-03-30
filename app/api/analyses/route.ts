import { requireAuth, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user
    return callGatewayV1Format('analysis' as ServiceName, 'list', {}, user.id)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user
    const body = await request.json()

    // V1 UI tam Analysis objesi gönderir (id, userId, input, result, risk, createdAt)
    // Client-side hesaplama yapılmış — direkt DB'ye kaydet
    if (body.id && body.input && body.result && body.risk) {
      const supabase = createAdminClient()
      const { error } = await supabase.from('analyses').upsert({
        id: body.id,
        user_id: user.id,
        marketplace: body.input.marketplace ?? 'trendyol',
        product_name: body.input.product_name ?? body.input.productName ?? '',
        inputs: body.input,
        outputs: body.result,
        risk_score: body.risk.score ?? 0,
        risk_level: body.risk.level ?? 'moderate',
        created_at: body.createdAt ?? new Date().toISOString(),
      }, { onConflict: 'id' })

      if (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 })
      }
      return Response.json({ success: true, id: body.id })
    }

    // Gateway üzerinden oluştur (camelCase input beklenir)
    return callGatewayV1Format('analysis' as ServiceName, 'create', { input: body }, user.id)
  } catch (error) {
    return errorResponse(error)
  }
}
