// ----------------------------------------------------------------
// SupportRepository — Katman 8
// Tablo: tickets
// v1 hata duzeltmesi: findAll() server-side pagination.
// ----------------------------------------------------------------

import { BaseRepository } from './base.repository'
import type { TicketRow, PaginatedResult } from '@/lib/db/types'

export interface TicketFilters {
  status?: string
  priority?: string
  category?: string
  search?: string
}

export interface TicketStats {
  open: number
  reviewing: number
  answeredToday: number
  total: number
}

export class SupportRepository extends BaseRepository<TicketRow> {
  protected tableName = 'tickets'

  async findByUserId(userId: string): Promise<TicketRow[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Talepler getirilemedi: ${error.message}`)
    }

    return (data ?? []) as TicketRow[]
  }

  async updateReply(
    id: string,
    adminReply: string,
    status: string
  ): Promise<TicketRow> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        admin_reply: adminReply,
        admin_replied_at: new Date().toISOString(),
        status,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Talep cevaplanamadi: ${error.message}`)
    }

    return data as TicketRow
  }

  async updateStatus(id: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({ status })
      .eq('id', id)

    if (error) {
      throw new Error(`Talep durumu guncellenemedi: ${error.message}`)
    }
  }

  async deleteByUser(userId: string, ticketId: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('id', ticketId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Talep silinemedi: ${error.message}`)
    }
  }

  /**
   * Admin: tum talepler (server-side pagination — v1 hata duzeltmesi).
   */
  async findAll(
    filters: TicketFilters = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResult<TicketRow>> {
    const offset = (page - 1) * pageSize

    let countQuery = this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })

    let dataQuery = this.supabase
      .from(this.tableName)
      .select('*')
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false })

    if (filters.status) {
      countQuery = countQuery.eq('status', filters.status)
      dataQuery = dataQuery.eq('status', filters.status)
    }
    if (filters.priority) {
      countQuery = countQuery.eq('priority', filters.priority)
      dataQuery = dataQuery.eq('priority', filters.priority)
    }
    if (filters.category) {
      countQuery = countQuery.eq('category', filters.category)
      dataQuery = dataQuery.eq('category', filters.category)
    }
    if (filters.search) {
      const searchFilter = `user_email.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`
      countQuery = countQuery.or(searchFilter)
      dataQuery = dataQuery.or(searchFilter)
    }

    const { count, error: countError } = await countQuery
    if (countError) {
      throw new Error(`Talep sayisi getirilemedi: ${countError.message}`)
    }

    const { data, error } = await dataQuery
    if (error) {
      throw new Error(`Talepler getirilemedi: ${error.message}`)
    }

    return {
      data: (data ?? []) as TicketRow[],
      total: count ?? 0,
      page,
      pageSize,
    }
  }

  async getStats(): Promise<TicketStats> {
    const today = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z'

    const [openRes, reviewRes, answeredRes, totalRes] = await Promise.all([
      this.supabase.from(this.tableName).select('*', { count: 'exact', head: true }).eq('status', 'acik'),
      this.supabase.from(this.tableName).select('*', { count: 'exact', head: true }).eq('status', 'inceleniyor'),
      this.supabase.from(this.tableName).select('*', { count: 'exact', head: true }).eq('status', 'cevaplandi').gte('admin_replied_at', today),
      this.supabase.from(this.tableName).select('*', { count: 'exact', head: true }),
    ])

    return {
      open: openRes.count ?? 0,
      reviewing: reviewRes.count ?? 0,
      answeredToday: answeredRes.count ?? 0,
      total: totalRes.count ?? 0,
    }
  }
}
