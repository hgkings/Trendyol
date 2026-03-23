import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin()
  if (!auth.authorized) return auth.response

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'pending'

  const isApproved = status === 'approved' ? true : status === 'rejected' ? false : null

  let query = auth.adminClient
    .from('blog_comments')
    .select('id, post_slug, author_name, content, created_at, is_approved')
    .order('created_at', { ascending: false })

  // pending = is_approved false AND not yet rejected (we use null as "pending" workaround is not needed;
  // we'll treat is_approved=false as "pending" since there's no separate rejected state)
  if (status === 'pending') {
    query = query.eq('is_approved', false)
  } else if (status === 'approved') {
    query = query.eq('is_approved', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('admin blog-comments GET error:', error)
    return NextResponse.json({ error: 'Yorumlar yüklenemedi' }, { status: 500 })
  }

  return NextResponse.json({ comments: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin()
  if (!auth.authorized) return auth.response

  try {
    const { id, action } = await req.json()

    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'id ve action (approve|reject) zorunludur' }, { status: 400 })
    }

    if (action === 'approve') {
      const { error } = await auth.adminClient
        .from('blog_comments')
        .update({ is_approved: true })
        .eq('id', id)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // reject → sil
    const { error } = await auth.adminClient
      .from('blog_comments')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('admin blog-comments PATCH error:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
