import { requireAuth, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const user = await requireAuth()
    if (user instanceof Response) return user

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/marketplace/trendyol/webhook`

    return callGatewayV1Format('marketplace' as ServiceName, 'registerTrendyolWebhook', { webhookUrl }, user.id)
  } catch (err: unknown) {
    return errorResponse(err)
  }
}
