import { type NextRequest } from 'next/server'
import { requireAuth, callGatewayV1Format } from '@/lib/api/helpers'

export async function POST(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult instanceof Response) return authResult

  const body = await req.json()
  const { analysisId, riskScore, riskLevel, productName } = body as {
    analysisId?: string
    riskScore?: number
    riskLevel?: string
    productName?: string
  }

  if (!analysisId) {
    return Response.json({ error: 'analysisId zorunludur' }, { status: 400 })
  }

  return callGatewayV1Format('notification', 'checkRiskAlert', {
    analysisId,
    riskScore: riskScore ?? 0,
    riskLevel: riskLevel ?? 'Safe',
    productName: productName ?? 'Bilinmeyen Ürün',
    userEmail: authResult.email,
    emailRiskAlertEnabled: true,
  }, authResult.id)
}
