import { errorResponse } from '@/lib/api/helpers'
import type { ServiceName } from '@/lib/gateway/types'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return Response.json({ error: 'slug zorunludur' }, { status: 400 })
    }

    const { initializeServices } = await import('@/services/registry')
    initializeServices()

    const { gateway } = await import('@/lib/gateway/gateway.adapter')
    const result = await gateway.handle('blog' as ServiceName, 'listComments', { slug }, 'anonymous')

    if (!result.success) {
      return Response.json({ error: result.error ?? 'Yorumlar yüklenemedi' }, { status: 500 })
    }

    return Response.json({ comments: result.data ?? [] })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { slug, author_name, content } = body as {
      slug?: string
      author_name?: string
      content?: string
    }

    if (!slug || !author_name?.trim() || !content?.trim()) {
      return Response.json({ error: 'slug, ad ve yorum zorunludur' }, { status: 400 })
    }

    if (author_name.trim().length > 100) {
      return Response.json({ error: 'Ad en fazla 100 karakter olabilir' }, { status: 400 })
    }

    if (content.trim().length > 2000) {
      return Response.json({ error: 'Yorum en fazla 2000 karakter olabilir' }, { status: 400 })
    }

    const { initializeServices } = await import('@/services/registry')
    initializeServices()

    const { gateway } = await import('@/lib/gateway/gateway.adapter')
    const result = await gateway.handle(
      'blog' as ServiceName,
      'createComment',
      { slug, author_name: author_name.trim(), content: content.trim() },
      'anonymous'
    )

    if (!result.success) {
      return Response.json({ error: result.error ?? 'Yorum gönderilemedi' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Geçersiz istek' }, { status: 400 })
  }
}
