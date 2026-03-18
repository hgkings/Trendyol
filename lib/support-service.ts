import { supabase } from './supabaseClient'
import { createAdminClient } from './supabase-server-client'
import {
  Ticket,
  CreateTicketDto,
  UpdateTicketDto,
  TicketFilters,
  TicketStats,
} from '@/types'

const TICKET_COLUMNS = 'id, user_id, user_email, subject, category, priority, status, message, admin_reply, admin_replied_at, created_at, updated_at'

// Öncelik sıralaması için yardımcı
const PRIORITY_ORDER = { acil: 0, yuksek: 1, normal: 2, dusuk: 3 }

// ─── Kullanıcı fonksiyonları ───────────────────────────────────────────────

export async function createTicket(
  userId: string,
  userEmail: string,
  data: CreateTicketDto
): Promise<Ticket> {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      user_id: userId,
      user_email: userEmail,
      subject: data.subject,
      category: data.category,
      priority: data.priority,
      message: data.message,
      status: 'acik',
    })
    .select(TICKET_COLUMNS)
    .single()

  if (error) throw new Error('Talep oluşturulamadı')
  return ticket as Ticket
}

export async function getUserTickets(
  userId: string,
  filters?: TicketFilters
): Promise<Ticket[]> {
  let query = supabase
    .from('tickets')
    .select(TICKET_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) throw new Error('Talepler yüklenemedi')
  return (data ?? []) as Ticket[]
}

export async function getTicketById(
  ticketId: string,
  userId: string
): Promise<Ticket | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select(TICKET_COLUMNS)
    .eq('id', ticketId)
    .eq('user_id', userId)
    .single()

  if (error) return null
  return data as Ticket
}

// ─── Admin fonksiyonları ───────────────────────────────────────────────────

export async function getAllTickets(filters?: TicketFilters): Promise<Ticket[]> {
  const admin = createAdminClient()

  let query = admin
    .from('tickets')
    .select(TICKET_COLUMNS)

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.priority) query = query.eq('priority', filters.priority)
  if (filters?.category) query = query.eq('category', filters.category)
  if (filters?.search) {
    query = query.or(`user_email.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw new Error('Talepler yüklenemedi')

  const tickets = (data ?? []) as Ticket[]

  // Öncelik → tarih sıralaması
  return tickets.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99
    const pb = PRIORITY_ORDER[b.priority] ?? 99
    if (pa !== pb) return pa - pb
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export async function replyToTicket(
  ticketId: string,
  data: UpdateTicketDto
): Promise<Ticket> {
  const admin = createAdminClient()

  const updates: Record<string, unknown> = {}
  if (data.status) updates.status = data.status
  if (data.admin_reply) {
    updates.admin_reply = data.admin_reply
    updates.admin_replied_at = new Date().toISOString()
  }

  const { data: ticket, error } = await admin
    .from('tickets')
    .update(updates)
    .eq('id', ticketId)
    .select(TICKET_COLUMNS)
    .single()

  if (error) throw new Error('Talep güncellenemedi')
  return ticket as Ticket
}

export async function deleteTicket(ticketId: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('tickets').delete().eq('id', ticketId)
  if (error) throw new Error('Talep silinemedi')
}

export async function getTicketStats(): Promise<TicketStats> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('tickets')
    .select('status, admin_replied_at')

  if (error) throw new Error('İstatistikler yüklenemedi')

  const tickets = data ?? []
  const today = new Date().toISOString().slice(0, 10)

  return {
    open: tickets.filter(t => t.status === 'acik').length,
    reviewing: tickets.filter(t => t.status === 'inceleniyor').length,
    answeredToday: tickets.filter(
      t => t.admin_replied_at?.slice(0, 10) === today
    ).length,
    total: tickets.length,
  }
}
