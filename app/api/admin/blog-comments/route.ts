import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

// TODO: callGatewayV1Format ile değiştirilecek
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'pending'

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
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof Response) return auth

  try {
    const { id, action } = await req.json()

    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'id ve action (approve|reject) zorunludur' }, { status: 400 })
    }

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
  } catch {
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
