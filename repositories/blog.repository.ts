// ----------------------------------------------------------------
// BlogRepository — Katman 8
// Tablo: blog_comments
// ----------------------------------------------------------------

import { BaseRepository } from './base.repository'
import type { BlogCommentRow } from '@/lib/db/types'

export class BlogRepository extends BaseRepository<BlogCommentRow> {
  protected tableName = 'blog_comments'

  async getApprovedComments(slug: string): Promise<BlogCommentRow[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('id, author_name, content, created_at')
      .eq('post_slug', slug)
      .eq('is_approved', true)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Yorumlar getirilemedi: ${error.message}`)
    }

    return (data ?? []) as BlogCommentRow[]
  }

  async createComment(data: {
    post_slug: string
    author_name: string
    content: string
  }): Promise<BlogCommentRow> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert({
        ...data,
        is_approved: false,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Yorum olusturulamadi: ${error.message}`)
    }

    return result as BlogCommentRow
  }

  async approveComment(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({ is_approved: true })
      .eq('id', id)

    if (error) {
      throw new Error(`Yorum onaylanamadi: ${error.message}`)
    }
  }

  async deleteComment(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Yorum silinemedi: ${error.message}`)
    }
  }

  async getAllComments(isApproved?: boolean): Promise<BlogCommentRow[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false })

    if (isApproved !== undefined) {
      query = query.eq('is_approved', isApproved)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Tum yorumlar getirilemedi: ${error.message}`)
    }

    return (data ?? []) as BlogCommentRow[]
  }
}
