'use client'

import { Ticket } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

interface TicketDetailDialogProps {
  ticket: Ticket | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATUS_LABELS: Record<string, string> = {
  acik: 'Açık',
  inceleniyor: 'İnceleniyor',
  cevaplandi: 'Cevaplandı',
  kapali: 'Kapalı',
}

const CATEGORY_LABELS: Record<string, string> = {
  teknik: 'Teknik Sorun',
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

export function TicketDetailDialog({ ticket, open, onOpenChange }: TicketDetailDialogProps) {
  if (!ticket) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">{ticket.subject}</DialogTitle>
          <DialogDescription>
            {CATEGORY_LABELS[ticket.category] ?? ticket.category}
            {' · '}
            {PRIORITY_LABELS[ticket.priority] ?? ticket.priority} Öncelik
            {' · '}
            {STATUS_LABELS[ticket.status] ?? ticket.status}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Mesajınız</h4>
              <div className="bg-muted/30 p-4 rounded-lg text-sm whitespace-pre-wrap">
                {ticket.message}
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {new Date(ticket.created_at).toLocaleString('tr-TR')}
            </div>

            {ticket.admin_reply && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-green-700 dark:text-green-400">Destek Cevabı</h4>
                <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg text-sm border border-green-200 dark:border-green-900 whitespace-pre-wrap">
                  {ticket.admin_reply}
                </div>
                {ticket.admin_replied_at && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(ticket.admin_replied_at).toLocaleString('tr-TR')}
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
