'use client'

import { Ticket } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'

interface TicketListProps {
  tickets: Ticket[]
  loading: boolean
  onSelectTicket: (ticket: Ticket) => void
}

const STATUS_STYLES: Record<string, string> = {
  acik: 'bg-blue-100 text-blue-800',
  inceleniyor: 'bg-yellow-100 text-yellow-800',
  cevaplandi: 'bg-green-100 text-green-800',
  kapali: 'bg-gray-100 text-gray-800',
}

const STATUS_LABELS: Record<string, string> = {
  acik: 'Açık',
  inceleniyor: 'İnceleniyor',
  cevaplandi: 'Cevaplandı',
  kapali: 'Kapalı',
}

const CATEGORY_LABELS: Record<string, string> = {
  teknik: 'Teknik',
  odeme: 'Ödeme',
  hesap: 'Hesap',
  oneri: 'Öneri',
  diger: 'Diğer',
}

const PRIORITY_LABELS: Record<string, string> = {
  dusuk: 'Düşük',
  normal: 'Normal',
  yuksek: 'Yüksek',
  acil: 'Acil',
}

function SkeletonRow() {
  return (
    <div className="flex justify-between p-4 bg-card rounded-xl border border-border/40 animate-pulse">
      <div className="space-y-2 flex-1">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-3 bg-muted rounded w-1/4" />
      </div>
      <div className="h-8 bg-muted rounded w-20" />
    </div>
  )
}

export function TicketList({ tickets, loading, onSelectTicket }: TicketListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
      </div>
    )
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground gap-2 border-2 border-dashed rounded-xl">
        <MessageSquare className="h-8 w-8 opacity-40" />
        <p className="text-sm">Henüz destek talebiniz bulunmuyor</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tickets.map(ticket => (
        <div
          key={ticket.id}
          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-card rounded-xl border border-border/40 hover:bg-muted/50 transition-colors"
        >
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{ticket.subject}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[ticket.status] ?? 'bg-gray-100 text-gray-800'}`}>
                {STATUS_LABELS[ticket.status] ?? ticket.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span>{new Date(ticket.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
              <span>·</span>
              <span>{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
              <span>·</span>
              <span>{PRIORITY_LABELS[ticket.priority] ?? ticket.priority} Öncelik</span>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="mt-3 sm:mt-0 shrink-0"
            onClick={() => onSelectTicket(ticket)}
          >
            Detay Gör
          </Button>
        </div>
      ))}
    </div>
  )
}
