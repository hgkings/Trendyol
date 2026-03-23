'use client'

import { useEffect, useState, useCallback } from 'react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Check, Trash2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

interface BlogComment {
  id: string
  post_slug: string
  author_name: string
  content: string
  created_at: string
  is_approved: boolean
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<BlogComment[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'approved'>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchComments = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/blog-comments?status=${tab}`)
      .then((r) => r.json())
      .then((data) => setComments(data.comments ?? []))
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setActionLoading(id)
    try {
      const res = await fetch('/api/admin/blog-comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      if (!res.ok) throw new Error()
      toast.success(action === 'approve' ? 'Yorum onaylandı' : 'Yorum silindi')
      setComments((prev) => prev.filter((c) => c.id !== id))
    } catch {
      toast.error('İşlem başarısız')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Blog Yorumları</h1>
          <p className="text-sm text-muted-foreground mt-1">Yorumları incele, onayla veya sil</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['pending', 'approved'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {t === 'pending' ? 'Bekleyen' : 'Onaylanan'}
            </button>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {tab === 'pending' ? 'Onay Bekleyen Yorumlar' : 'Onaylanan Yorumlar'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin h-5 w-5" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {tab === 'pending' ? 'Bekleyen yorum yok.' : 'Onaylanan yorum yok.'}
              </p>
            ) : (
              <div className="divide-y">
                {comments.map((c) => (
                  <div key={c.id} className="py-4 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{c.author_name}</span>
                          <span className="text-xs text-muted-foreground">
                            /blog/{c.post_slug}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                          {c.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {tab === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-green-600 border-green-600/30 hover:bg-green-600/10"
                            disabled={actionLoading === c.id}
                            onClick={() => handleAction(c.id, 'approve')}
                          >
                            {actionLoading === c.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            <span className="ml-1">Onayla</span>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                          disabled={actionLoading === c.id}
                          onClick={() => handleAction(c.id, 'reject')}
                        >
                          {actionLoading === c.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1">Sil</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
