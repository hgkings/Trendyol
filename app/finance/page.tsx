'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatPercent, formatNumber } from '@/components/shared/format'
import { toast } from 'sonner'
import { UpgradeModal } from '@/components/shared/upgrade-modal'
import { isProUser } from '@/utils/access'
import { motion } from 'framer-motion'
import {
  Loader2, Wallet, TrendingUp, TrendingDown,
  ArrowUpRight, Receipt, RefreshCw, Calendar, AlertTriangle,
  Package, BarChart3, Store, Percent,
  ShieldAlert, CreditCard, Truck, RotateCcw
} from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTooltip, PieChart, Pie, Cell
} from 'recharts'

// ─── Tipler ──────────────────────────────────────────────────────

interface Settlement {
  siparisId: string
  paketId: number
  barkod: string
  islemTipi: string
  komisyonOrani: number
  komisyonTutari: number
  saticiHakedis: number
  alacak: number
  borc: number
  odemeTarihi: string | null
  islemTarihi: string | null
  odemeNo: number
  faturaNuarasi: string
}

interface OtherFinancial {
  islemTipi: string
  tutar: number
  aciklama: string
  tarih: string | null
}

interface Claim {
  claimId: string
  orderNumber: string
  claimReason: string
  claimDate: string | null
  status: string
  totalAmount: number
  lines: Array<{
    productName: string
    barcode: string
    quantity: number
    amount: number
  }>
}

interface FinansOzet {
  brutSatis: number
  komisyonKesintisi: number
  komisyonOrani: number
  iadeKesintisi: number
  kargoKesintisi: number
  digerKesintiler: number
  netHakedis: number
  toplamIslem: number
  ortalamaSiparisTutari: number
  islemTipleri: Record<string, number>
}

// ─── Yardımcılar ─────────────────────────────────────────────────

function hesaplaOzet(settlements: Settlement[], others: OtherFinancial[]): FinansOzet {
  let brutSatis = 0
  let komisyonKesintisi = 0
  let iadeKesintisi = 0
  let toplamAlacak = 0
  let toplamBorc = 0
  let satisAdet = 0
  const islemTipleri: Record<string, number> = {}

  for (const s of settlements) {
    toplamAlacak += s.alacak
    toplamBorc += s.borc

    const tip = s.islemTipi || 'Diger'
    islemTipleri[tip] = (islemTipleri[tip] || 0) + 1

    const tipLower = tip.toLowerCase()
    const isSale = tip === 'Sale' || tipLower === 'satış' || tipLower.includes('sale')
    const isReturn = tip === 'Return' || tipLower === 'iade' || tipLower.includes('return')

    if (isSale) {
      brutSatis += s.alacak
      satisAdet++
      komisyonKesintisi += Math.abs(s.komisyonTutari)
    } else if (isReturn) {
      iadeKesintisi += Math.abs(s.borc)
      if (s.komisyonTutari < 0) {
        komisyonKesintisi -= Math.abs(s.komisyonTutari)
      }
    }
    // CommissionPositive/CommissionNegative → toplamAlacak/toplamBorc'a zaten dahil
    // Ayrıca kategorize etmeye gerek yok — netHakedis'te otomatik hesaplanıyor
  }

  let digerKesintiler = 0
  for (const o of others) {
    if (o.tutar < 0) {
      digerKesintiler += Math.abs(o.tutar)
    }
  }

  const netHakedis = toplamAlacak - toplamBorc
  const komisyonOrani = brutSatis > 0 ? (komisyonKesintisi / brutSatis) * 100 : 0
  const ortalamaSiparisTutari = satisAdet > 0 ? brutSatis / satisAdet : 0

  // Kargo kesintisi: diğer finansallardan Stoppage veya kargo ilişkili
  let kargoKesintisi = 0
  for (const o of others) {
    const tip = (o.islemTipi || '').toLowerCase()
    if (tip.includes('cargo') || tip.includes('kargo') || tip === 'stoppage') {
      kargoKesintisi += Math.abs(o.tutar)
    }
  }
  digerKesintiler -= kargoKesintisi

  return {
    brutSatis,
    komisyonKesintisi,
    komisyonOrani,
    iadeKesintisi,
    kargoKesintisi,
    digerKesintiler: Math.max(0, digerKesintiler),
    netHakedis,
    toplamIslem: settlements.length,
    ortalamaSiparisTutari,
    islemTipleri,
  }
}

function iadeAnaliziHesapla(claims: Claim[]) {
  const toplamIade = claims.length
  let toplamTutar = 0
  const sebepDagilimi: Record<string, number> = {}
  const urunDagilimi: Record<string, { adet: number; tutar: number }> = {}
  const durumDagilimi: Record<string, number> = {}

  for (const claim of claims) {
    toplamTutar += claim.totalAmount

    const sebep = claim.claimReason || 'Belirtilmemiş'
    sebepDagilimi[sebep] = (sebepDagilimi[sebep] || 0) + 1

    const durum = claim.status || 'Bilinmiyor'
    durumDagilimi[durum] = (durumDagilimi[durum] || 0) + 1

    for (const line of claim.lines) {
      const key = line.productName || line.barcode || 'Bilinmeyen'
      if (!urunDagilimi[key]) urunDagilimi[key] = { adet: 0, tutar: 0 }
      urunDagilimi[key].adet += line.quantity
      urunDagilimi[key].tutar += line.amount
    }
  }

  // En çok iade edilen 5 ürün
  const enCokIade = Object.entries(urunDagilimi)
    .sort((a, b) => b[1].adet - a[1].adet)
    .slice(0, 5)
    .map(([urun, v]) => ({ urun, ...v }))

  // Sebep dağılımı
  const sebepler = Object.entries(sebepDagilimi)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([sebep, adet]) => ({ sebep, adet, oran: toplamIade > 0 ? (adet / toplamIade) * 100 : 0 }))

  return { toplamIade, toplamTutar, enCokIade, sebepler, durumDagilimi }
}

function tarihFormati(tarih: string | null): string {
  if (!tarih) return '—'
  try {
    return new Date(tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return '—' }
}

const PIE_COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#10b981', '#6b7280']

function ChartTooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border/50 bg-card backdrop-blur-xl px-4 py-3 shadow-md">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-foreground">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Ana Bileşen ─────────────────────────────────────────────────

type MarketplaceKey = 'trendyol' | 'hepsiburada'
type PeriodKey = '7' | '15' | '30' | '60' | '90'

export default function FinancePage() {
  const { user } = useAuth()
  const isPro = isProUser(user)

  const [marketplace, setMarketplace] = useState<MarketplaceKey>('trendyol')
  const [period, setPeriod] = useState<PeriodKey>('30')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Veri
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [otherFinancials, setOtherFinancials] = useState<OtherFinancial[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [connected, setConnected] = useState(false)

  // Sekme
  const [activeTab, setActiveTab] = useState<'ozet' | 'islemler' | 'iadeler' | 'guncelle'>('ozet')

  // Upgrade modal
  const [showUpgrade, setShowUpgrade] = useState(false)

  // Enrich (otomatik güncelleme)
  const [enriching, setEnriching] = useState(false)
  const [enrichResult, setEnrichResult] = useState<{
    enriched: number; skipped: number;
    details: Array<{ productName: string; field: string; oldValue: number; newValue: number }>
  } | null>(null)

  // ─── Veri çekme ──────────────────────────────────────────────

  const fetchFinanceData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // 1. Bağlantı durumunu kontrol et
      const statusRes = await fetch(`/api/marketplace/${marketplace}`)
      const statusData = await statusRes.json()

      if (!statusData?.connected && statusData?.status !== 'connected') {
        setConnected(false)
        setSettlements([])
        setOtherFinancials([])
        setClaims([])
        return
      }
      setConnected(true)

      // 2. Finans verilerini çek
      const financeRes = await fetch(`/api/marketplace/${marketplace}/finance?gun=${period}`)
      const finData = await financeRes.json()
      if (financeRes.ok && finData.success !== false) {
        setSettlements(finData.settlements || [])
        setOtherFinancials(finData.otherFinancials || [])
        if (finData.warning) {
          toast.error(`Hakediş: ${finData.warning}`)
        }
      } else {
        const errMsg = finData.error || finData.warning || `Finans verisi alınamadı (HTTP ${financeRes.status})`
        toast.error(errMsg)
      }

      // 3. İade verilerini çek
      const claimsRes = await fetch(`/api/marketplace/${marketplace}/claims?gun=${period}`)
      if (claimsRes.ok) {
        const claimsData = await claimsRes.json()
        setClaims(claimsData.claims || claimsData.iadeListesi || [])
      } else {
        toast.error('İade verileri alınamadı')
      }

      if (isRefresh) toast.success('Finans verileri yenilendi')
    } catch {
      toast.error('Finans verileri yüklenemedi')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [marketplace, period])

  useEffect(() => {
    if (isPro) fetchFinanceData()
  }, [fetchFinanceData, isPro])

  // ─── Enrich handler ─────────────────────────────────────────

  const handleEnrich = useCallback(async () => {
    setEnriching(true)
    setEnrichResult(null)
    try {
      const res = await fetch(`/api/marketplace/${marketplace}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: Number(period) > 30 ? Number(period) : 90 }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error || 'Güncelleme başarısız')
      }
      const data = await res.json()
      setEnrichResult(data)
      if (data.enriched > 0) {
        toast.success(`${data.enriched} ürün gerçek verilerle güncellendi!`)
      } else {
        toast.info('Güncellenecek yeni veri bulunamadı.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Güncelleme sırasında hata oluştu'
      toast.error(msg)
    } finally {
      setEnriching(false)
    }
  }, [marketplace, period])

  // ─── Hesaplamalar ────────────────────────────────────────────

  const ozet = useMemo(() => hesaplaOzet(settlements, otherFinancials), [settlements, otherFinancials])
  const iadeAnalizi = useMemo(() => iadeAnaliziHesapla(claims), [claims])

  // Hakediş breakdown chart data
  const hakedisBreakdown = useMemo(() => {
    const items = [
      { ad: 'Komisyon', tutar: ozet.komisyonKesintisi, color: '#f59e0b' },
      { ad: 'İade', tutar: ozet.iadeKesintisi, color: '#ef4444' },
      { ad: 'Kargo', tutar: ozet.kargoKesintisi, color: '#3b82f6' },
      { ad: 'Diğer', tutar: ozet.digerKesintiler, color: '#8b5cf6' },
    ].filter(i => i.tutar > 0)
    return items
  }, [ozet])

  // İşlem tipi bar chart
  const islemTipiChart = useMemo(() => {
    return Object.entries(ozet.islemTipleri)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tip, adet]) => ({ tip, adet }))
  }, [ozet])

  // ─── Pro olmayan kullanıcılar ────────────────────────────────

  if (!isPro) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <div className="p-4 rounded-full bg-amber-500/10">
            <Wallet className="h-10 w-10 text-amber-700 dark:text-amber-400" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Hakediş &amp; Finans Paneli</h2>
            <p className="text-muted-foreground max-w-md">
              Gerçek hakediş tutarlarınızı, komisyon kesintilerinizi ve iade analizlerinizi görün.
              Bu özellik Pro plan ile kullanılabilir.
            </p>
          </div>
          <Button onClick={() => setShowUpgrade(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
            Pro&apos;ya Yükselt
          </Button>
          <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
        </div>
      </DashboardLayout>
    )
  }

  // ─── Bağlantı yok ───────────────────────────────────────────

  if (!loading && !connected) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10">
              <Wallet className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Hakediş &amp; Finans</h1>
              <p className="text-sm text-muted-foreground">Gerçek hakediş, komisyon ve iade analizi</p>
            </div>
          </div>

          <Card className="border-border/40">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <Store className="h-12 w-12 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold">Mağaza Bağlantısı Gerekli</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Finans verilerinizi görmek için önce Pazaryeri sayfasından mağazanızı bağlayın.
              </p>
              <Button variant="outline" onClick={() => window.location.href = '/marketplace'}>
                <Store className="h-4 w-4 mr-2" />
                Pazaryeri Sayfasına Git
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  // ─── Yükleniyor ─────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10">
              <Wallet className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Hakediş &amp; Finans</h1>
              <p className="text-sm text-muted-foreground">Veriler yükleniyor...</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="border-border/40">
                <CardContent className="p-4">
                  <div className="animate-pulse space-y-3">
                    <div className="h-3 bg-muted rounded w-20" />
                    <div className="h-7 bg-muted rounded w-28" />
                    <div className="h-2 bg-muted rounded w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // ─── Ana Sayfa ──────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Başlık + Filtreler */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10">
              <Wallet className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Hakediş &amp; Finans</h1>
              <p className="text-sm text-muted-foreground">Gerçek hakediş, komisyon ve iade analizi</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={marketplace} onValueChange={(v) => setMarketplace(v as MarketplaceKey)}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trendyol">Trendyol</SelectItem>
                <SelectItem value="hepsiburada">Hepsiburada</SelectItem>
              </SelectContent>
            </Select>

            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="w-[110px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 Gün</SelectItem>
                <SelectItem value="15">15 Gün</SelectItem>
                <SelectItem value="30">30 Gün</SelectItem>
                <SelectItem value="60">60 Gün</SelectItem>
                <SelectItem value="90">90 Gün</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchFinanceData(true)}
              disabled={refreshing}
              className="h-9"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Yenile
            </Button>
          </div>
        </div>

        {/* Sekmeler */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted/30 border border-border/30 w-fit overflow-x-auto">
          {([
            { key: 'ozet', label: 'Hakediş Özeti', icon: Wallet },
            { key: 'islemler', label: 'İşlem Detayları', icon: Receipt },
            { key: 'iadeler', label: 'İade Analizi', icon: RotateCcw },
            { key: 'guncelle', label: 'Gerçek Veri', icon: RefreshCw },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-card border border-border/50 text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/*  SEKME 1: HAKEDİŞ ÖZETİ                                 */}
        {/* ══════════════════════════════════════════════════════════ */}

        {activeTab === 'ozet' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* KPI Kartları */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Net Hakediş */}
              <Card className="border-border/40 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-4 relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-muted-foreground">Net Hakediş</span>
                    <div className="p-1.5 rounded-lg bg-emerald-500/10">
                      <Wallet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                  <p className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(ozet.netHakedis)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Son {period} gün
                  </p>
                </CardContent>
              </Card>

              {/* Brüt Satış */}
              <Card className="border-border/40 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-4 relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-muted-foreground">Brüt Satış</span>
                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                      <TrendingUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <p className="text-xl font-bold tabular-nums">
                    {formatCurrency(ozet.brutSatis)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatNumber(ozet.toplamIslem)} işlem
                  </p>
                </CardContent>
              </Card>

              {/* Komisyon Kesintisi */}
              <Card className="border-border/40 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-4 relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-muted-foreground">Komisyon</span>
                    <div className="p-1.5 rounded-lg bg-amber-500/10">
                      <Percent className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                  <p className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                    -{formatCurrency(ozet.komisyonKesintisi)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Ort. {formatPercent(ozet.komisyonOrani)}
                  </p>
                </CardContent>
              </Card>

              {/* İade Kesintisi */}
              <Card className="border-border/40 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-4 relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-muted-foreground">İade Kesintisi</span>
                    <div className="p-1.5 rounded-lg bg-red-500/10">
                      <RotateCcw className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                  <p className="text-xl font-bold tabular-nums text-red-700 dark:text-red-400">
                    -{formatCurrency(ozet.iadeKesintisi)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatNumber(iadeAnalizi.toplamIade)} iade
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Hakediş Detay + Kesinti Dağılımı */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Hakediş Detay Kartı */}
              <Card className="border-border/40">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Receipt className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                    <h3 className="font-semibold text-sm">Hakediş Detayı</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-sm">Brüt Satış</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                        +{formatCurrency(ozet.brutSatis)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <div className="flex items-center gap-2">
                        <Percent className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-sm">Komisyon ({formatPercent(ozet.komisyonOrani)})</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                        -{formatCurrency(ozet.komisyonKesintisi)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-sm">İade Kesintisi</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-red-700 dark:text-red-400">
                        -{formatCurrency(ozet.iadeKesintisi)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <div className="flex items-center gap-2">
                        <Truck className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-sm">Kargo Kesintisi</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                        -{formatCurrency(ozet.kargoKesintisi)}
                      </span>
                    </div>

                    {ozet.digerKesintiler > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-border/30">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-3.5 w-3.5 text-violet-500" />
                          <span className="text-sm">Diğer Kesintiler</span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-violet-700 dark:text-violet-400">
                          -{formatCurrency(ozet.digerKesintiler)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center py-3 bg-emerald-500/5 rounded-xl px-3 -mx-1 mt-2">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-bold">Net Hakediş</span>
                      </div>
                      <span className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(ozet.netHakedis)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Kesinti Dağılımı Grafik */}
              <Card className="border-border/40">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                    <h3 className="font-semibold text-sm">Kesinti Dağılımı</h3>
                  </div>

                  {hakedisBreakdown.length > 0 ? (
                    <div className="flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={hakedisBreakdown}
                            dataKey="tutar"
                            nameKey="ad"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                          >
                            {hakedisBreakdown.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="flex flex-wrap gap-3 mt-2 justify-center">
                        {hakedisBreakdown.map((item, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-muted-foreground">{item.ad}</span>
                            <span className="font-medium">{formatCurrency(item.tutar)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                      Kesinti verisi bulunamadı
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Alt bilgi kartları */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-border/40">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Ort. Sipariş Tutarı</p>
                    <p className="text-sm font-bold tabular-nums">{formatCurrency(ozet.ortalamaSiparisTutari)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/40">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Dönem</p>
                    <p className="text-sm font-bold">Son {period} gün</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/40">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Store className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Pazaryeri</p>
                    <p className="text-sm font-bold capitalize">{marketplace}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/*  SEKME 2: İŞLEM DETAYLARI                                */}
        {/* ══════════════════════════════════════════════════════════ */}

        {activeTab === 'islemler' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* İşlem Tipi Grafiği */}
            {islemTipiChart.length > 0 && (
              <Card className="border-border/40">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-sm mb-4">İşlem Tipi Dağılımı</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={islemTipiChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="tip" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <RechartsTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="adet" fill="hsl(38, 92%, 50%)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* İşlem Tablosu */}
            <Card className="border-border/40">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/20">
                        <th className="text-left p-3 font-medium text-muted-foreground text-xs">Tarih</th>
                        <th className="text-left p-3 font-medium text-muted-foreground text-xs">İşlem Tipi</th>
                        <th className="text-left p-3 font-medium text-muted-foreground text-xs">Sipariş No</th>
                        <th className="text-left p-3 font-medium text-muted-foreground text-xs">Barkod</th>
                        <th className="text-right p-3 font-medium text-muted-foreground text-xs">Komisyon %</th>
                        <th className="text-right p-3 font-medium text-muted-foreground text-xs">Alacak</th>
                        <th className="text-right p-3 font-medium text-muted-foreground text-xs">Borç</th>
                        <th className="text-right p-3 font-medium text-muted-foreground text-xs">Hakediş</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlements.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-muted-foreground">
                            Bu dönem için işlem bulunamadı
                          </td>
                        </tr>
                      ) : (
                        settlements.slice(0, 100).map((s, i) => (
                          <tr key={i} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                            <td className="p-3 text-xs tabular-nums">{tarihFormati(s.islemTarihi)}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-[10px] font-medium">
                                {s.islemTipi}
                              </Badge>
                            </td>
                            <td className="p-3 text-xs tabular-nums font-mono">{s.siparisId || '—'}</td>
                            <td className="p-3 text-xs tabular-nums font-mono">{s.barkod || '—'}</td>
                            <td className="p-3 text-right text-xs tabular-nums">
                              {s.komisyonOrani > 0 ? formatPercent(s.komisyonOrani) : '—'}
                            </td>
                            <td className="p-3 text-right text-xs tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                              {s.alacak > 0 ? `+${formatCurrency(s.alacak)}` : '—'}
                            </td>
                            <td className="p-3 text-right text-xs tabular-nums text-red-700 dark:text-red-400 font-medium">
                              {s.borc > 0 ? `-${formatCurrency(s.borc)}` : '—'}
                            </td>
                            <td className="p-3 text-right text-xs tabular-nums font-semibold">
                              {formatCurrency(s.saticiHakedis)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {settlements.length > 100 && (
                  <div className="p-3 text-center text-xs text-muted-foreground border-t border-border/30">
                    İlk 100 işlem gösteriliyor. Toplam: {formatNumber(settlements.length)} işlem
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/*  SEKME 3: İADE ANALİZİ                                   */}
        {/* ══════════════════════════════════════════════════════════ */}

        {activeTab === 'iadeler' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* İade KPI'ları */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card className="border-border/40">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-muted-foreground">Toplam İade</span>
                    <div className="p-1.5 rounded-lg bg-red-500/10">
                      <RotateCcw className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                  <p className="text-xl font-bold tabular-nums">{formatNumber(iadeAnalizi.toplamIade)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">adet</p>
                </CardContent>
              </Card>

              <Card className="border-border/40">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-muted-foreground">İade Tutarı</span>
                    <div className="p-1.5 rounded-lg bg-red-500/10">
                      <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                  <p className="text-xl font-bold tabular-nums text-red-700 dark:text-red-400">
                    {formatCurrency(iadeAnalizi.toplamTutar)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">toplam kayıp</p>
                </CardContent>
              </Card>

              <Card className="border-border/40">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-muted-foreground">İade Oranı</span>
                    <div className="p-1.5 rounded-lg bg-amber-500/10">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                  <p className="text-xl font-bold tabular-nums">
                    {ozet.toplamIslem > 0
                      ? formatPercent((iadeAnalizi.toplamIade / ozet.toplamIslem) * 100)
                      : '%0'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">iade / sipariş</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* İade Sebepleri */}
              <Card className="border-border/40">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                    İade Sebepleri
                  </h3>

                  {iadeAnalizi.sebepler.length > 0 ? (
                    <div className="space-y-3">
                      {iadeAnalizi.sebepler.map((s, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground truncate max-w-[200px]">{s.sebep}</span>
                            <span className="font-medium tabular-nums">{s.adet} ({formatPercent(s.oran)})</span>
                          </div>
                          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(s.oran, 100)}%`,
                                backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">İade verisi bulunamadı</p>
                  )}
                </CardContent>
              </Card>

              {/* En Çok İade Edilen Ürünler */}
              <Card className="border-border/40">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <Package className="h-4 w-4 text-red-600 dark:text-red-400" />
                    En Çok İade Edilen Ürünler
                  </h3>

                  {iadeAnalizi.enCokIade.length > 0 ? (
                    <div className="space-y-3">
                      {iadeAnalizi.enCokIade.map((urun, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                            <span className="text-sm truncate max-w-[180px]">{urun.urun}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <Badge variant="outline" className="text-[10px]">
                              {urun.adet} adet
                            </Badge>
                            <span className="text-xs font-semibold tabular-nums text-red-700 dark:text-red-400">
                              {formatCurrency(urun.tutar)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">İade verisi bulunamadı</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/*  SEKME 4: GERÇEK VERİ GÜNCELLEMESİ                      */}
        {/* ══════════════════════════════════════════════════════════ */}

        {activeTab === 'guncelle' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Açıklama */}
            <Card className="border-border/40 border-l-4 border-l-amber-500">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 shrink-0 mt-0.5">
                    <RefreshCw className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">Analizlerinizi Gerçek Verilerle Güncelleyin</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Bu işlem {marketplace === 'trendyol' ? 'Trendyol' : 'Hepsiburada'} sipariş ve iade verilerinizi analiz ederek
                      mevcut ürün analizlerinizdeki <strong>komisyon oranını</strong>, <strong>iade oranını</strong> ve <strong>aylık satış adedini</strong> gerçek
                      verilerle günceller. Sadece ürün maliyetiniz elle girilen olarak kalır.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px] bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400">
                        <Percent className="h-2.5 w-2.5 mr-1" />
                        Gerçek Komisyon
                      </Badge>
                      <Badge variant="outline" className="text-[10px] bg-red-500/5 border-red-500/20 text-red-700 dark:text-red-400">
                        <RotateCcw className="h-2.5 w-2.5 mr-1" />
                        Gerçek İade Oranı
                      </Badge>
                      <Badge variant="outline" className="text-[10px] bg-blue-500/5 border-blue-500/20 text-blue-700 dark:text-blue-400">
                        <Package className="h-2.5 w-2.5 mr-1" />
                        Gerçek Aylık Satış
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Güncelle Butonu */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleEnrich}
                disabled={enriching}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {enriching ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {enriching ? 'Güncelleniyor...' : 'Gerçek Verilerle Güncelle'}
              </Button>
              <span className="text-xs text-muted-foreground">
                Son {Number(period) > 30 ? period : '90'} günlük veri analiz edilecek
              </span>
            </div>

            {/* Sonuçlar */}
            {enrichResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Özet Kartları */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-border/40">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10">
                        <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Güncellenen</p>
                        <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                          {enrichResult.enriched} ürün
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/40">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted/50">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Değişiklik Yok</p>
                        <p className="text-lg font-bold tabular-nums">{enrichResult.skipped} ürün</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Detay Tablosu */}
                {enrichResult.details.length > 0 && (
                  <Card className="border-border/40">
                    <CardContent className="p-0">
                      <div className="p-4 border-b border-border/30">
                        <h3 className="font-semibold text-sm">Güncelleme Detayları</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/30 bg-muted/20">
                              <th className="text-left p-3 font-medium text-muted-foreground text-xs">Ürün</th>
                              <th className="text-left p-3 font-medium text-muted-foreground text-xs">Alan</th>
                              <th className="text-right p-3 font-medium text-muted-foreground text-xs">Eski Değer</th>
                              <th className="text-right p-3 font-medium text-muted-foreground text-xs">Yeni Değer</th>
                              <th className="text-right p-3 font-medium text-muted-foreground text-xs">Fark</th>
                            </tr>
                          </thead>
                          <tbody>
                            {enrichResult.details.map((d, i) => {
                              const diff = d.newValue - d.oldValue
                              return (
                                <tr key={i} className="border-b border-border/20 hover:bg-muted/10">
                                  <td className="p-3 text-xs font-medium truncate max-w-[200px]">{d.productName}</td>
                                  <td className="p-3">
                                    <Badge variant="outline" className="text-[10px]">{d.field}</Badge>
                                  </td>
                                  <td className="p-3 text-right text-xs tabular-nums text-muted-foreground">
                                    {d.field === 'Aylık Satış' ? formatNumber(d.oldValue) : formatPercent(d.oldValue)}
                                  </td>
                                  <td className="p-3 text-right text-xs tabular-nums font-medium">
                                    {d.field === 'Aylık Satış' ? formatNumber(d.newValue) : formatPercent(d.newValue)}
                                  </td>
                                  <td className={`p-3 text-right text-xs tabular-nums font-medium ${
                                    diff > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                                  }`}>
                                    {diff > 0 ? '+' : ''}{d.field === 'Aylık Satış' ? formatNumber(diff) : formatPercent(diff)}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

      </div>
    </DashboardLayout>
  )
}
