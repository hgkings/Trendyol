import { NextRequest } from 'next/server'
import { requireAdmin, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'
import { z } from 'zod'

const UpdateUserPlanSchema = z.object({
  userId: z.string().uuid('Geçerli bir kullanıcı ID\'si gerekli'),
  plan: z.enum(['free', 'starter', 'starter_monthly', 'starter_yearly', 'pro', 'pro_monthly', 'pro_yearly']),
  pro_until: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof Response) return auth

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? undefined
    const plan = searchParams.get('plan') ?? undefined
    const page = parseInt(searchParams.get('page') ?? '1')

    return callGatewayV1Format('user', 'searchUsers', { search, plan, page, limit: 20 }, auth.id)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof Response) return auth

    const body = await req.json()
    const parsed = UpdateUserPlanSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { success: false, error: 'Doğrulama hatası', details: parsed.error.errors },
        { status: 422 }
      )
    }

    // Admin kendi planini degistiremez
    if (parsed.data.userId === auth.id) {
      return Response.json(
        { success: false, error: 'Kendi planınızı değiştiremezsiniz' },
        { status: 403 }
      )
    }

    return callGatewayV1Format('user', 'updateUserPlan', parsed.data, auth.id)
  } catch (error) {
    return errorResponse(error)
  }
}
