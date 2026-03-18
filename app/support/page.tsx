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
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            onClick={() => setFormOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-muted/30 transition-colors"
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
      </div>

      <TicketDetailDialog
        ticket={selectedTicket}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </DashboardLayout>
  )
}
