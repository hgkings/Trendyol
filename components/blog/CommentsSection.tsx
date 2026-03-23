'use client'

import { useEffect, useState } from 'react'

interface Comment {
  id: string
  author_name: string
  content: string
  created_at: string
}

interface Props {
  slug: string
}

export function CommentsSection({ slug }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [authorName, setAuthorName] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/blog/comments?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => setComments(data.comments ?? []))
      .finally(() => setLoading(false))
  }, [slug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/blog/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, author_name: authorName, content }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Bir hata oluştu')
        return
      }

      setSubmitted(true)
      setAuthorName('')
      setContent('')
    } catch {
      setError('Bağlantı hatası, lütfen tekrar deneyin.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mt-16 border-t border-[rgba(255,255,255,0.06)] pt-10">
      <h2 className="text-lg font-semibold text-foreground mb-6">
        Yorumlar{comments.length > 0 && <span className="ml-2 text-sm font-normal text-[rgba(255,255,255,0.4)]">({comments.length})</span>}
      </h2>

      {/* Yorum Listesi */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-xl bg-[rgba(255,255,255,0.04)] h-20" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-[rgba(255,255,255,0.35)] mb-8">
          Henüz yorum yok. İlk yorumu sen yap!
        </p>
      ) : (
        <div className="space-y-4 mb-10">
          {comments.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-5 py-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{c.author_name}</span>
                <span className="text-xs text-[rgba(255,255,255,0.3)]">
                  {new Date(c.created_at).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <p className="text-sm text-[rgba(255,255,255,0.7)] leading-relaxed whitespace-pre-wrap">
                {c.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Yorum Formu */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Yorum Yaz</h3>

        {submitted ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
            Yorumunuz alındı, incelendikten sonra yayınlanacak.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="Adınız"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              required
              maxLength={100}
              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-sm text-foreground placeholder:text-[rgba(255,255,255,0.25)] focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            <textarea
              placeholder="Yorumunuzu yazın..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              maxLength={2000}
              rows={4}
              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-sm text-foreground placeholder:text-[rgba(255,255,255,0.25)] focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
            />
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-[1px] hover:shadow-lg hover:shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}
            >
              {submitting ? 'Gönderiliyor...' : 'Yorum Gönder'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
