'use client'

import { useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'

interface TicketDetailDialogProps {
  ticket: Ticket | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onReply?: () => void
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

export function TicketDetailDialog({ ticket, open, onOpenChange, onReply }: TicketDetailDialogProps) {
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  if (!ticket) return null

  const canReply = ticket.status !== 'kapali'

  const handleReply = async () => {
    if (!replyText.trim()) return
    setReplying(true)
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText.trim() }),
      })
      if (res.ok) {
        toast.success('Yanıtınız gönderildi.')
        setReplyText('')
        onReply?.()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Yanıt gönderilemedi.')
      }
    } catch {
      toast.error('Bir hata oluştu.')
    } finally {
      setReplying(false)
    }
  }

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
                <h4 className="text-sm font-medium text-green-400">Destek Cevabı</h4>
                <div className="bg-green-950/30 p-4 rounded-lg text-sm border border-green-900 whitespace-pre-wrap">
                  {ticket.admin_reply}
                </div>
                {ticket.admin_replied_at && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(ticket.admin_replied_at).toLocaleString('tr-TR')}
                  </p>
                )}
              </div>
            )}

            {/* Kullanıcı yanıt alanı */}
            {canReply && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Yanıt Yazın</h4>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  maxLength={2000}
                  className="w-full min-h-[80px] rounded-lg border border-border/60 bg-muted/10 p-3 text-sm placeholder:text-muted-foreground resize-y focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20"
                />
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${replyText.length > 1800 ? 'text-amber-700 dark:text-amber-400' : replyText.length > 1950 ? 'text-red-400' : 'text-muted-foreground'}`}>{replyText.length}/2000</span>
                  <Button
                    size="sm"
                    disabled={replying || !replyText.trim()}
                    onClick={handleReply}
                    className="gap-1.5"
                  >
                    {replying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Gönder
                  </Button>
                </div>
              </div>
            )}

            {!canReply && (
              <div className="text-center py-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Bu bilet kapatılmış.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { onOpenChange(false) }}
                  className="text-xs"
                >
                  Yeni Destek Bileti Aç
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
