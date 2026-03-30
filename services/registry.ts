// ----------------------------------------------------------------
// Service Registry — Repo instance'lari olusturur, servislere inject eder,
// ServiceBridge'e kaydeder.
// API route'lar baslamadan once initializeServices() cagrilmali.
// payment.logic.ts 🔒 — FAZ8'de eklendi.
// ----------------------------------------------------------------

import { serviceBridge } from '@/lib/gateway/service.bridge'
import type { LogicService } from '@/lib/gateway/types'
import { createAdminClient } from '@/lib/supabase/admin'

import { AnalysisRepository } from '@/repositories/analysis.repository'
import { UserRepository } from '@/repositories/user.repository'
import { NotificationRepository } from '@/repositories/notification.repository'
import { SupportRepository } from '@/repositories/support.repository'
import { MarketplaceRepository } from '@/repositories/marketplace.repository'
import { CommissionRepository } from '@/repositories/commission.repository'
import { BlogRepository } from '@/repositories/blog.repository'
import { PaymentRepository } from '@/repositories/payment.repository'
import { ProductRepository } from '@/repositories/product.repository'

import { AnalysisLogic } from './analysis.logic'
import { RiskLogic } from './risk.logic'
import { CommissionLogic } from './commission.logic'
import { UserLogic } from './user.logic'
import { MarketplaceLogic } from './marketplace.logic'
import { NotificationLogic } from './notification.logic'
import { SupportLogic } from './support.logic'
import { PdfLogic } from './pdf.logic'
import { BlogLogic } from './blog.logic'
import { PaymentLogic } from './payment.logic'
import { ProductLogic } from './product.logic'

let initialized = false

/**
 * Tum servisleri ServiceBridge'e kaydeder.
 * Repo instance'lari olusturur ve servislere inject eder.
 * Idempotent — birden fazla cagri guvenlidir.
 */
export function initializeServices(): void {
  if (initialized) return

  const supabase = createAdminClient()

  // Repository instance'lari
  const analysisRepo = new AnalysisRepository(supabase)
  const userRepo = new UserRepository(supabase)
  const notificationRepo = new NotificationRepository(supabase)
  const supportRepo = new SupportRepository(supabase)
  const marketplaceRepo = new MarketplaceRepository(supabase)
  const commissionRepo = new CommissionRepository(supabase)
  const blogRepo = new BlogRepository(supabase)
  const paymentRepo = new PaymentRepository(supabase)
  const productRepo = new ProductRepository(supabase)

  // Service instance'lari (repo DI)
  const analysisLogic = new AnalysisLogic(analysisRepo, userRepo)
  const riskLogic = new RiskLogic()
  const commissionLogic = new CommissionLogic(commissionRepo)
  const userLogic = new UserLogic(userRepo)
  const marketplaceLogic = new MarketplaceLogic(marketplaceRepo, productRepo, analysisRepo)
  const notificationLogic = new NotificationLogic(notificationRepo)
  const supportLogic = new SupportLogic(supportRepo)
  const pdfLogic = new PdfLogic(analysisRepo)
  const blogLogic = new BlogLogic(blogRepo)
  const paymentLogic = new PaymentLogic(paymentRepo)
  const productLogic = new ProductLogic(analysisRepo, productRepo)

  // ServiceBridge'e kaydet
  serviceBridge.register('analysis', analysisLogic as unknown as LogicService)
  serviceBridge.register('risk', riskLogic as unknown as LogicService)
  serviceBridge.register('commission', commissionLogic as unknown as LogicService)
  serviceBridge.register('user', userLogic as unknown as LogicService)
  serviceBridge.register('marketplace', marketplaceLogic as unknown as LogicService)
  serviceBridge.register('notification', notificationLogic as unknown as LogicService)
  serviceBridge.register('support', supportLogic as unknown as LogicService)
  serviceBridge.register('pdf', pdfLogic as unknown as LogicService)
  serviceBridge.register('blog', blogLogic as unknown as LogicService)

  serviceBridge.register('payment', paymentLogic as unknown as LogicService)
  serviceBridge.register('product', productLogic as unknown as LogicService)

  initialized = true
}
