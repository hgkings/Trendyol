import { NextRequest } from 'next/server'
import { requireAdmin, callGatewayV1Format, errorResponse } from '@/lib/api/helpers'
import { z } from 'zod'

const CommentActionSchema = z.object({
  id: z.string().uuid('Geçerli bir yorum ID\'si gerekli'),
  action: z.enum(['approve', 'reject'], { message: 'action approve veya reject olmalıdır' }),
})

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof Response) return auth

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? 'pending'
    const isApproved = status === 'approved' ? true : status === 'pending' ? false : undefined

    return callGatewayV1Format('blog', 'listAllComments', { isApproved }, auth.id)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof Response) return auth

    const body = await req.json()
    const parsed = CommentActionSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { success: false, error: 'Doğrulama hatası', details: parsed.error.errors },
        { status: 422 }
      )
    }

    return callGatewayV1Format('blog', 'moderateComment', {
      commentId: parsed.data.id,
      action: parsed.data.action,
    }, auth.id)
  } catch (error) {
    return errorResponse(error)
  }
}
