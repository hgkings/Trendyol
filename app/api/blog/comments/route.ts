import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin-client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'slug zorunludur' }, { status: 400 })
  }

  const client = createSupabaseAdminClient()
  const { data, error } = await client
    .from('blog_comments')
    .select('id, author_name, content, created_at')
    .eq('post_slug', slug)
    .eq('is_approved', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('blog comments GET error:', error)
    return NextResponse.json({ error: 'Yorumlar yüklenemedi' }, { status: 500 })
  }

  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(req: NextRequest) {
  try {
    const { slug, author_name, content } = await req.json()

    if (!slug || !author_name?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'slug, ad ve yorum zorunludur' }, { status: 400 })
    }

    if (author_name.trim().length > 100) {
      return NextResponse.json({ error: 'Ad en fazla 100 karakter olabilir' }, { status: 400 })
    }

    if (content.trim().length > 2000) {
      return NextResponse.json({ error: 'Yorum en fazla 2000 karakter olabilir' }, { status: 400 })
    }

    const client = createSupabaseAdminClient()
    const { error } = await client.from('blog_comments').insert({
      post_slug: slug,
      author_name: author_name.trim(),
      content: content.trim(),
      is_approved: false,
    })

    if (error) {
      console.error('blog comments POST error:', error)
      return NextResponse.json({ error: 'Yorum gönderilemedi' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }
}
