// ----------------------------------------------------------------
// BlogLogic — Katman 6
// Blog yazilari (statik) + yorum yonetimi (DB).
// KNOWLEDGE-BASE.md Section 15.
// v1 hata duzeltmesi: Blog yorumuna rate limiting.
// ----------------------------------------------------------------

import { ServiceError } from '@/lib/gateway/types'
import { checkRateLimit } from '@/lib/security/rate-limit'
import type { BlogRepository } from '@/repositories/blog.repository'

// ----------------------------------------------------------------
// Tipler
// ----------------------------------------------------------------

export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  readTime: number
  content: string
}

export interface BlogComment {
  id: string
  postSlug: string
  authorName: string
  content: string
  createdAt: string
  isApproved: boolean
}

export interface CreateCommentPayload {
  slug: string
  authorName: string
  content: string
  ip?: string
}

// ----------------------------------------------------------------
// Statik blog yazilari (v1'den — lib/blog.ts'de saklanir)
// FAZ7'de gercek icerikle doldurulacak.
// ----------------------------------------------------------------

const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'hepsiburada-gercek-karinizi-nasil-hesaplarsiniz',
    title: 'Hepsiburada\'da Gerçek Kârınızı Nasıl Hesaplarsınız?',
    description: 'Hepsiburada komisyonları, kargo ve iade maliyetlerini hesaba katarak gerçek kârınızı öğrenin.',
    date: '2026-03-15',
    readTime: 8,
    content: '', // FAZ7'de doldurulacak
  },
  {
    slug: 'trendyol-komisyon-oranlari-2026',
    title: 'Trendyol Komisyon Oranları 2026 — Tam Liste',
    description: 'Trendyol\'un 2026 yılı güncel komisyon oranları, kategori bazlı detaylı tablo.',
    date: '2026-03-10',
    readTime: 6,
    content: '', // FAZ7'de doldurulacak
  },
  {
    slug: 'trendyolda-gercek-karinizi-nasil-hesaplarsiniz',
    title: 'Trendyol\'da Gerçek Kârınızı Nasıl Hesaplarsınız?',
    description: 'Trendyol satışlarınızın gerçek kârlılığını hesaplamak için bilmeniz gereken her şey.',
    date: '2026-03-05',
    readTime: 10,
    content: '', // FAZ7'de doldurulacak
  },
]

// ----------------------------------------------------------------
// Servis
// ----------------------------------------------------------------

export class BlogLogic {
  constructor(private readonly blogRepo: BlogRepository) {}
  /**
   * Tum blog yazilarini listeler (statik, content haric).
   */
  async listPosts(
    _traceId: string,
    _payload: unknown,
    _userId: string
  ): Promise<Omit<BlogPost, 'content'>[]> {
    return BLOG_POSTS.map(({ content: _content, ...post }) => post)
  }

  /**
   * Tekil blog yazisi getirir (slug ile).
   */
  async getPost(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<BlogPost> {
    const { slug } = payload as { slug: string }
    const post = BLOG_POSTS.find(p => p.slug === slug)

    if (!post) {
      throw new ServiceError('Blog yazısı bulunamadı', {
        code: 'POST_NOT_FOUND',
        statusCode: 404,
        traceId,
      })
    }

    return post
  }

  /**
   * Onaylanan yorumlari listeler.
   * FAZ5'te repository baglanacak.
   */
  async listComments(
    _traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<unknown[]> {
    const { slug } = payload as { slug: string }
    return this.blogRepo.getApprovedComments(slug)
  }

  /**
   * Yorum olusturur (moderasyon bekler).
   * v1 hata duzeltmesi: Rate limiting uygulanir.
   */
  async createComment(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean; message: string }> {
    const input = payload as CreateCommentPayload

    // v1 hata duzeltmesi: Rate limiting
    const identifier = input.ip ?? 'anonymous'
    const rateLimitResult = await checkRateLimit('comment', identifier)
    if (!rateLimitResult.success) {
      throw new ServiceError('Çok fazla yorum gönderdiniz. Lütfen bekleyin.', {
        code: 'COMMENT_RATE_LIMITED',
        statusCode: 429,
        traceId,
      })
    }

    if (!input.authorName || input.authorName.length > 100) {
      throw new ServiceError('İsim 1-100 karakter arasında olmalıdır', {
        code: 'INVALID_AUTHOR_NAME',
        statusCode: 400,
        traceId,
      })
    }

    if (!input.content || input.content.length > 2000) {
      throw new ServiceError('Yorum 1-2000 karakter arasında olmalıdır', {
        code: 'INVALID_COMMENT_CONTENT',
        statusCode: 400,
        traceId,
      })
    }

    // Slug kontrolu — gercek yazi var mi?
    const postExists = BLOG_POSTS.some(p => p.slug === input.slug)
    if (!postExists) {
      throw new ServiceError('Blog yazısı bulunamadı', {
        code: 'POST_NOT_FOUND',
        statusCode: 404,
        traceId,
      })
    }

    await this.blogRepo.createComment({
      post_slug: input.slug,
      author_name: input.authorName,
      content: input.content,
    })

    return {
      success: true,
      message: 'Yorumunuz alındı, incelendikten sonra yayınlanacak.',
    }
  }

  /**
   * Admin yorum onaylar veya reddeder.
   * FAZ5'te repository baglanacak.
   */
  async moderateComment(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean }> {
    const { commentId, action } = payload as {
      commentId: string
      action: 'approve' | 'reject'
    }

    if (!commentId) {
      throw new ServiceError('Yorum ID\'si zorunludur', {
        code: 'MISSING_COMMENT_ID',
        statusCode: 400,
        traceId,
      })
    }

    if (action !== 'approve' && action !== 'reject') {
      throw new ServiceError('Geçersiz işlem. "approve" veya "reject" olmalıdır', {
        code: 'INVALID_ACTION',
        statusCode: 400,
        traceId,
      })
    }

    if (action === 'approve') {
      await this.blogRepo.approveComment(commentId)
    } else {
      await this.blogRepo.deleteComment(commentId)
    }

    return { success: true }
  }

  /**
   * Admin icin tum yorumlari listeler (onay durumuna gore).
   * FAZ5'te repository baglanacak.
   */
  async listAllComments(
    _traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ comments: unknown[]; total: number }> {
    const { isApproved } = (payload ?? {}) as { isApproved?: boolean }
    const comments = await this.blogRepo.getAllComments(isApproved)
    return { comments, total: comments.length }
  }
}

// Instance olusturma registry.ts'de yapilir (repo DI)
