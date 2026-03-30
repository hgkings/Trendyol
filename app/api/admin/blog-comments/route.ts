import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const CommentActionSchema = z.object({
  id: z.string().uuid('Geçerli bir yorum ID\'si gerekli'),
  action: z.enum(['approve', 'reject'], { message: 'action approve veya reject olmalıdır' }),
})

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'pending'

  try {
    const adminClient = createAdminClient()

    let query = adminClient
      .from('blog_comments')
      .select('id, post_slug, author_name, content, created_at, is_approved')
      .order('created_at', { ascending: false })

    if (status === 'pending') {
      query = query.eq('is_approved', false)
    } else if (status === 'approved') {
      query = query.eq('is_approved', true)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Yorumlar yüklenemedi' }, { status: 500 })
    }

    return NextResponse.json({ comments: data ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: 'Bir hata oluştu', message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  try {
    const body = await req.json()
    const parsed = CommentActionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Doğrulama hatası', details: parsed.error.errors },
        { status: 422 }
      )
    }

    const { id, action } = parsed.data
    const adminClient = createAdminClient()

    if (action === 'approve') {
      const { error } = await adminClient
        .from('blog_comments')
        .update({ is_approved: true })
        .eq('id', id)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // reject → sil
    const { error } = await adminClient
      .from('blog_comments')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: 'İşlem başarısız', message }, { status: 500 })
  }
}
