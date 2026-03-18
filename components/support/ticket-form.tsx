'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { CreateTicketSchema } from '@/lib/validations/support'
import { CreateTicketDto, TicketCategory, TicketPriority } from '@/types'

const MAX_MESSAGE_LENGTH = 5000

interface TicketFormProps {
  onSuccess: () => void
  onCreate: (data: CreateTicketDto) => Promise<boolean>
}

const EMPTY_FORM = {
  subject: '',
  category: '' as TicketCategory | '',
  priority: 'normal' as TicketPriority,
  message: '',
}

export function TicketForm({ onSuccess, onCreate }: TicketFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const parsed = CreateTicketSchema.safeParse(formData)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      parsed.error.errors.forEach(err => {
        const field = err.path[0] as string
        fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      await onCreate(parsed.data)
      setFormData(EMPTY_FORM)
      onSuccess()
    } catch (err: unknown) {
      setErrors({ form: err instanceof Error ? err.message : 'Bir hata oluştu' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.form && (
        <p className="text-sm text-destructive">{errors.form}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Kategori</Label>
          <Select
            value={formData.category}
            onValueChange={v => setFormData({ ...formData, category: v as TicketCategory })}
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="Kategori Seçin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="teknik">Teknik Sorun</SelectItem>
              <SelectItem value="odeme">Ödeme</SelectItem>
              <SelectItem value="hesap">Hesap</SelectItem>
              <SelectItem value="oneri">Öneri</SelectItem>
              <SelectItem value="diger">Diğer</SelectItem>
            </SelectContent>
          </Select>
          {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Öncelik</Label>
          <Select
            value={formData.priority}
            onValueChange={v => setFormData({ ...formData, priority: v as TicketPriority })}
          >
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dusuk">Düşük</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="yuksek">Yüksek</SelectItem>
              <SelectItem value="acil">Acil</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Konu</Label>
        <Input
          id="subject"
          placeholder="Örn: Raporlama hatası"
          value={formData.subject}
          onChange={e => setFormData({ ...formData, subject: e.target.value })}
          maxLength={200}
        />
        {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">
          Mesaj
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            {formData.message.length}/{MAX_MESSAGE_LENGTH}
          </span>
        </Label>
        <Textarea
          id="message"
          placeholder="Sorununuzu detaylı açıklayın... (en az 20 karakter)"
          value={formData.message}
          onChange={e => setFormData({ ...formData, message: e.target.value })}
          maxLength={MAX_MESSAGE_LENGTH}
          className="min-h-[120px]"
        />
        {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Gönderiliyor...
          </>
        ) : (
          'Talep Gönder'
        )}
      </Button>
    </form>
  )
}
