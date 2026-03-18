'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Ticket, TicketStats, TicketStatus, TicketPriority, TicketCategory, UpdateTicketDto } from '@/types'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, RefreshCw, MessageSquare, Trash2 } from 'lucide-react'

// ─── Sabitler ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  acik: 'bg-blue-100 text-blue-800',
  inceleniyor: 'bg-yellow-100 text-yellow-800',
  cevaplandi: 'bg-green-100 text-green-800',
  kapali: 'bg-gray-100 text-gray-800',
}
const STATUS_LABELS: Record<string, string> = {
  acik: 'Açık', inceleniyor: 'İnceleniyor', cevaplandi: 'Cevaplandı', kapali: 'Kapalı',
}

const PRIORITY_STYLES: Record<string, string> = {
  acil: 'bg-red-100 text-red-800',
  yuksek: 'bg-orange-100 text-orange-800',
  normal: 'bg-gray-100 text-gray-700',
  dusuk: 'bg-gray-50 text-gray-500',
}
const PRIORITY_LABELS: Record<string, string> = {
  dusuk: 'Düşük', normal: 'Normal', yuksek: 'Yüksek', acil: 'Acil',
}

const CATEGORY_LABELS: Record<string, string> = {
  teknik: 'Teknik', odeme: 'Ödeme', hesap: 'Hesap', oneri: 'Öneri', diger: 'Diğer',
}

// ─── useDebounce ─────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ─── Ana bileşen ─────────────────────────────────────────────────────────────

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [stats, setStats] = useState<TicketStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [reply, setReply] = useState('')
  const [replyStatus, setReplyStatus] = useState<TicketStatus>('inceleniyor')

  // Filtreler
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 500)

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (priorityFilter) params.set('priority', priorityFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      if (debouncedSearch) params.set('search', debouncedSearch)

      const [ticketRes, statsRes] = await Promise.all([
        fetch(`/api/admin/support/tickets?${params}`),
        fetch('/api/admin/support/tickets?stats=1'),
      ])

      if (!ticketRes.ok) throw new Error()
      const ticketJson = await ticketRes.json()
      setTickets(ticketJson.data ?? [])

      if (statsRes.ok) {
        const statsJson = await statsRes.json()
        setStats(statsJson.data)
      }
    } catch {
      toast.error('Talepler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, priorityFilter, categoryFilter, debouncedSearch])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  const handleOpenTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setReply(ticket.admin_reply ?? '')
    setReplyStatus(ticket.status)
  }

  const handleReply = async () => {
    if (!selectedTicket) return
    setSaving(true)
    try {
      const body: UpdateTicketDto = { status: replyStatus }
      if (reply.trim()) body.admin_reply = reply.trim()

      const res = await fetch(`/api/admin/support/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const updated: Ticket = json.data
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
      setSelectedTicket(updated)
      toast.success('Talep güncellendi')
    } catch {
      toast.error('Güncelleme başarısız')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = async () => {
    if (!selectedTicket) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/support/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'kapali' }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const updated: Ticket = json.data
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
      setSelectedTicket(null)
      toast.success('Talep kapatıldı')
    } catch {
      toast.error('İşlem başarısız')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedTicket) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/support/tickets/${selectedTicket.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      setTickets(prev => prev.filter(t => t.id !== selectedTicket.id))
      setSelectedTicket(null)
      toast.success('Talep silindi')
    } catch {
      toast.error('Silme başarısız')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Başlık */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Destek Talepleri</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tickets.length} toplam
              {stats && (
                <>
                  {' · '}
                  <span className="text-blue-600 font-medium">{stats.open} açık</span>
                  {' · '}
                  <span className="text-yellow-600 font-medium">{stats.reviewing} inceleniyor</span>
                  {' · '}
                  <span className="text-green-600 font-medium">Bugün {stats.answeredToday} cevap</span>
                </>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchTickets}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Yenile
          </Button>
        </div>

        {/* İstatistik kartları */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Açık', value: stats.open, color: 'text-blue-600' },
              { label: 'İnceleniyor', value: stats.reviewing, color: 'text-yellow-600' },
              { label: 'Bugün Cevaplanan', value: stats.answeredToday, color: 'text-green-600' },
              { label: 'Toplam', value: stats.total, color: 'text-foreground' },
            ].map(card => (
              <Card key={card.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filtreler */}
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Durum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              <SelectItem value="acik">Açık</SelectItem>
              <SelectItem value="inceleniyor">İnceleniyor</SelectItem>
              <SelectItem value="cevaplandi">Cevaplandı</SelectItem>
              <SelectItem value="kapali">Kapalı</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter || 'all'} onValueChange={v => setPriorityFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Öncelik" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Öncelikler</SelectItem>
              <SelectItem value="acil">Acil</SelectItem>
              <SelectItem value="yuksek">Yüksek</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="dusuk">Düşük</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter || 'all'} onValueChange={v => setCategoryFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Kategoriler</SelectItem>
              <SelectItem value="teknik">Teknik</SelectItem>
              <SelectItem value="odeme">Ödeme</SelectItem>
              <SelectItem value="hesap">Hesap</SelectItem>
              <SelectItem value="oneri">Öneri</SelectItem>
              <SelectItem value="diger">Diğer</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Email veya konu ara..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-52"
          />
        </div>

        {/* Tablo */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin h-6 w-6" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
            <MessageSquare className="h-8 w-8 opacity-40" />
            <p>Gösterilecek destek talebi yok</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map(ticket => (
              <Card key={ticket.id} className="hover:bg-muted/10 transition-colors">
                <CardContent className="p-4 flex flex-col sm:flex-row gap-4 justify-between">
                  <div
                    className="flex-1 space-y-1 cursor-pointer"
                    onClick={() => handleOpenTicket(ticket)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{ticket.subject}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLES[ticket.priority]}`}>
                        {PRIORITY_LABELS[ticket.priority]}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[ticket.status]}`}>
                        {STATUS_LABELS[ticket.status]}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                        {CATEGORY_LABELS[ticket.category]}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{ticket.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {ticket.user_email} · {new Date(ticket.created_at).toLocaleString('tr-TR')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => handleOpenTicket(ticket)}
                  >
                    Cevapla
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Cevap Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={open => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTicket?.subject}</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="flex gap-2 text-xs flex-wrap">
                <span className="font-medium">{selectedTicket.user_email}</span>
                <span>·</span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLES[selectedTicket.priority]}`}>
                  {PRIORITY_LABELS[selectedTicket.priority]}
                </span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[selectedTicket.status]}`}>
                  {STATUS_LABELS[selectedTicket.status]}
                </span>
              </div>

              <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                {selectedTicket.message}
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Cevap</Label>
                  <Textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    rows={4}
                    placeholder="Kullanıcıya cevap yaz..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Durum</Label>
                  <Select value={replyStatus} onValueChange={v => setReplyStatus(v as TicketStatus)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acik">Açık</SelectItem>
                      <SelectItem value="inceleniyor">İnceleniyor</SelectItem>
                      <SelectItem value="cevaplandi">Cevaplandı</SelectItem>
                      <SelectItem value="kapali">Kapalı</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleReply} disabled={saving || (!reply.trim() && replyStatus === selectedTicket.status)} size="sm">
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
                    Cevapla & Kaydet
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClose}
                    disabled={saving || selectedTicket.status === 'kapali'}
                  >
                    Talebi Kapat
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="ml-auto text-destructive hover:text-destructive"
                  >
                    {deleting
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />
                    }
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
