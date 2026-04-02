'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { TicketForm } from '@/components/support/ticket-form'
import { TicketList } from '@/components/support/ticket-list'
import { TicketDetailDialog } from '@/components/support/ticket-detail-dialog'
import { useSupportTickets } from '@/hooks/use-support-tickets'
import { Ticket } from '@/types'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function SupportPage() {
  const { tickets, loading, createTicket, refetch } = useSupportTickets()
  const [formOpen, setFormOpen] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleCreateSuccess = () => {
    toast.success('Destek talebiniz oluşturuldu.')
    setFormOpen(false)
    refetch()
  }

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setDialogOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8 p-4 sm:p-0">
        <div className="pt-4">
          <h1 className="text-2xl font-bold tracking-tight">Destek</h1>
          <p className="text-muted-foreground text-sm mt-1">Yeni talep oluştur veya mevcut taleplerinizi görüntüleyin.</p>
        </div>

        {/* Yeni Talep Formu */}
        <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
          <button
            onClick={() => setFormOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-muted/50 transition-colors"
          >
            <span>Yeni Destek Talebi Oluştur</span>
            {formOpen
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
            }
          </button>
          {formOpen && (
            <div className="px-5 pb-5 border-t border-border">
              <div className="pt-4">
                <TicketForm
                  onSuccess={handleCreateSuccess}
                  onCreate={createTicket}
                />
              </div>
            </div>
          )}
        </div>

        {/* Mevcut Talepler */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Taleplerim</h2>
          <TicketList
            tickets={tickets}
            loading={loading}
            onSelectTicket={handleSelectTicket}
          />
        </div>

        {/* Doğrudan İletişim */}
        <div className="rounded-xl border border-border/40 bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Doğrudan İletişim
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Acil durumlar veya destek talebi dışındaki sorularınız için bize doğrudan ulaşabilirsiniz.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-muted-foreground/70">E-posta</p>
                <a href="mailto:karnet.destek@gmail.com" className="text-sm font-medium text-blue-400 hover:underline">
                  karnet.destek@gmail.com
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-700 dark:text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div>
                <p className="text-xs text-muted-foreground/70">WhatsApp</p>
                <a href="https://wa.me/905433824521" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:underline">
                  +90 543 382 45 21
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TicketDetailDialog
        ticket={selectedTicket}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </DashboardLayout>
  )
}
