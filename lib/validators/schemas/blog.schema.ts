import { z } from 'zod'

export const CreateCommentSchema = z.object({
  slug: z.string().min(1),
  authorName: z.string().min(1).max(100, 'İsim en fazla 100 karakter olabilir'),
  content: z.string().min(1).max(2000, 'Yorum en fazla 2000 karakter olabilir'),
})

export const ModerateCommentSchema = z.object({
  commentId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
})