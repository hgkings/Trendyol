'use client'

import { useState, useEffect, useCallback } from 'react'
import { Ticket, TicketStatus, CreateTicketDto } from '@/types'

export function useSupportTickets(statusFilter?: TicketStatus) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/support/tickets?${params}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setTickets(json.data ?? [])
    } catch {
      setError('Talepler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  const createTicket = useCallback(async (data: CreateTicketDto): Promise<boolean> => {
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Bir hata oluştu')
      }
      await fetchTickets()
      return true
    } catch (err) {
      throw err
    }
  }, [fetchTickets])

  return { tickets, loading, error, createTicket, refetch: fetchTickets }
}
