// ----------------------------------------------------------------
// SupportLogic — Katman 6
// Destek talep yonetimi.
// KNOWLEDGE-BASE.md Section 12.
// v1 hata duzeltmesi: Admin cevabinda email gonder.
// ----------------------------------------------------------------

import { ServiceError } from '@/lib/gateway/types'
import { sendEmail } from '@/lib/email/send'
import type { SupportRepository } from '@/repositories/support.repository'

// ----------------------------------------------------------------
// Tipler
// ----------------------------------------------------------------

export type TicketStatus = 'acik' | 'inceleniyor' | 'cevaplandi' | 'kapali'
export type TicketPriority = 'dusuk' | 'normal' | 'yuksek' | 'acil'
export type TicketCategory = 'teknik' | 'odeme' | 'hesap' | 'oneri' | 'diger'

export interface Ticket {
  id: string
  userId: string
  userEmail: string
  subject: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  message: string
  adminReply: string | null
  adminRepliedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTicketPayload {
  subject: string
  category: TicketCategory
  priority: TicketPriority
  message: string
  userEmail: string
}

export interface ReplyPayload {
  ticketId: string
  adminReply: string
  newStatus?: TicketStatus
  userEmail: string
}

// ----------------------------------------------------------------
// Servis
// ----------------------------------------------------------------

export class SupportLogic {
  constructor(private readonly supportRepo: SupportRepository) {}

  /**
   * Destek talebi olusturur.
   */
  async createTicket(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ ticketId: string }> {
    const input = payload as CreateTicketPayload

    if (!input.subject || input.subject.length > 200) {
      throw new ServiceError('Konu 1-200 karakter arasında olmalıdır', {
        code: 'INVALID_SUBJECT',
        statusCode: 400,
        traceId,
      })
    }

    if (!input.message || input.message.length < 20 || input.message.length > 5000) {
      throw new ServiceError('Mesaj 20-5000 karakter arasında olmalıdır', {
        code: 'INVALID_MESSAGE',
        statusCode: 400,
        traceId,
      })
    }

    const row = await this.supportRepo.create({
      user_id: userId,
      user_email: input.userEmail,
      subject: input.subject,
      category: input.category,
      priority: input.priority,
      status: 'acik',
      message: input.message,
      admin_reply: null,
      admin_replied_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    return { ticketId: row.id }
  }

  /**
   * Kullanici taleplerini listeler.
   */
  async listTickets(
    _traceId: string,
    _payload: unknown,
    userId: string
  ): Promise<unknown[]> {
    return this.supportRepo.findByUserId(userId)
  }

  /**
   * Tekil talep getirir.
   */
  async getTicket(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<unknown> {
    const { ticketId } = payload as { ticketId: string }
    if (!ticketId) {
      throw new ServiceError('Talep ID\'si zorunludur', {
        code: 'MISSING_TICKET_ID',
        statusCode: 400,
        traceId,
      })
    }
    return this.supportRepo.findById(ticketId)
  }

  /**
   * Admin talebe cevap verir.
   * v1 hata duzeltmesi: Cevap sonrasi kullaniciya email gonderilir.
   */
  async replyToTicket(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean; emailSent: boolean }> {
    const input = payload as ReplyPayload

    if (!input.ticketId) {
      throw new ServiceError('Talep ID\'si zorunludur', {
        code: 'MISSING_TICKET_ID',
        statusCode: 400,
        traceId,
      })
    }

    if (!input.adminReply || input.adminReply.trim().length === 0) {
      throw new ServiceError('Cevap boş olamaz', {
        code: 'EMPTY_REPLY',
        statusCode: 400,
        traceId,
      })
    }

    await this.supportRepo.updateReply(
      input.ticketId,
      input.adminReply,
      input.newStatus ?? 'cevaplandi'
    )

    // v1 hata duzeltmesi: Kullaniciya email gonder
    let emailSent = false
    if (input.userEmail) {
      try {
        await sendEmail({
          to: input.userEmail,
          subject: 'Destek Talebinize Cevap Verildi — Kârnet',
          html: `
            <h2>Destek Talebinize Cevap Verildi</h2>
            <p>Merhaba,</p>
            <p>Destek talebinize cevap verildi:</p>
            <blockquote style="border-left: 3px solid #0ea5e9; padding-left: 12px; color: #374151;">
              ${input.adminReply}
            </blockquote>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/support">Taleplerinizi Görüntüleyin</a></p>
            <p>Kârnet Destek Ekibi</p>
          `,
        })
        emailSent = true
      } catch {
        // Email hatasi talep cevabini engellemez
      }
    }

    return { success: true, emailSent }
  }

  /**
   * Talebi kapatir.
   */
  async closeTicket(
    traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<{ success: boolean }> {
    const { ticketId } = payload as { ticketId: string }
    if (!ticketId) {
      throw new ServiceError('Talep ID\'si zorunludur', {
        code: 'MISSING_TICKET_ID',
        statusCode: 400,
        traceId,
      })
    }
    await this.supportRepo.updateStatus(ticketId, 'kapali')
    return { success: true }
  }

  /**
   * Kullanicinin kendi talebini siler (sahiplik kontrolu).
   */
  async deleteTicket(
    traceId: string,
    payload: unknown,
    userId: string
  ): Promise<{ success: boolean }> {
    const { ticketId } = payload as { ticketId: string }
    if (!ticketId) {
      throw new ServiceError('Talep ID\'si zorunludur', {
        code: 'MISSING_TICKET_ID',
        statusCode: 400,
        traceId,
      })
    }
    await this.supportRepo.deleteByUser(userId, ticketId)
    return { success: true }
  }

  /**
   * Talep istatistiklerini dondurur (admin).
   */
  async getTicketStats(
    _traceId: string,
    _payload: unknown,
    _userId: string
  ): Promise<{ open: number; reviewing: number; answeredToday: number; total: number }> {
    return this.supportRepo.getStats()
  }

  /**
   * Admin icin tum talepleri listeler (filtre + pagination).
   */
  async listAllTickets(
    _traceId: string,
    payload: unknown,
    _userId: string
  ): Promise<unknown> {
    const filters = payload as { status?: string; priority?: string; category?: string; search?: string; page?: number }
    return this.supportRepo.findAll(
      { status: filters.status, priority: filters.priority, category: filters.category, search: filters.search },
      filters.page ?? 1
    )
  }
}

// Instance olusturma registry.ts'de yapilir (repo DI)
