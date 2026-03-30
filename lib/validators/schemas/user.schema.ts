import { z } from 'zod'

export const UpdateProfileSchema = z.object({
  full_name: z.string().max(200).optional(),
  email_notifications_enabled: z.boolean().optional(),
  email_weekly_report: z.boolean().optional(),
  email_risk_alert: z.boolean().optional(),
  email_margin_alert: z.boolean().optional(),
  email_pro_expiry: z.boolean().optional(),
  target_margin: z.number().min(0).max(100).optional(),
  margin_alert: z.boolean().optional(),
  default_marketplace: z.string().optional(),
  default_commission: z.number().min(0).max(100).optional(),
  default_vat: z.number().min(0).max(100).optional(),
  default_return_rate: z.number().min(0).max(100).optional(),
  default_ads_cost: z.number().min(0).optional(),
})

export const AdminUpdateUserSchema = z.object({
  userId: z.string().uuid(),
  plan: z.enum(['free', 'starter', 'pro', 'admin']),
})