'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import {
  Check, X, Crown, Loader2, RefreshCw, Zap,
  CheckCircle2, XCircle, ChevronDown, ChevronUp, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLAN_LIMITS } from '@/config/plans';
import { PRICING } from '@/config/pricing';
import { isProUser, isStarterUser } from '@/utils/access';
import { toast } from 'sonner';
import { PricingSection } from '@/components/shared/PricingSection';
import type { PricingTier } from '@/components/shared/PricingSection';

// ─── types ───────────────────────────────────────────────────────────────────
type BillingCycle = 'monthly' | 'yearly';

// ─── constants ───────────────────────────────────────────────────────────────
const FREE_LIMIT = PLAN_LIMITS.free.maxProducts;
const STARTER_LIMIT = PLAN_LIMITS.starter.maxProducts;
const STARTER_MONTHLY = PRICING.starter.monthly;
const STARTER_YEARLY  = PRICING.starter.annual;
const PRO_MONTHLY     = PRICING.pro.monthly;
const PRO_YEARLY      = PRICING.pro.annual;

const COMPARISON_ROWS: { label: string; free: string | boolean; starter: string | boolean; pro: string | boolean }[] = [
  { label: 'Ürün analizi',                        free: `${FREE_LIMIT} ürün`,      starter: `${STARTER_LIMIT} ürün`, pro: 'Sınırsız' },
  { label: 'Temel kâr hesaplama',                 free: true,    starter: true,    pro: true    },
  { label: 'PRO Muhasebe Modu (KDV ayrıştırma)',  free: false,   starter: true,    pro: true    },
  { label: 'Hassasiyet analizi',                  free: false,   starter: true,    pro: true    },
  { label: 'Başa-baş noktası analizi',            free: false,   starter: true,    pro: true    },
  { label: 'CSV içe / dışa aktarma',              free: false,   starter: true,    pro: true    },
  { label: 'Pazaryeri karşılaştırması',           free: false,   starter: false,   pro: true    },
  { label: 'Nakit akışı tahmini',                 free: false,   starter: false,   pro: true    },
  { label: 'Trendyol / Hepsiburada API',          free: false,   starter: false,   pro: true    },
  { label: 'PDF rapor',                           free: false,   starter: '5/ay',  pro: 'Sınırsız' },
  { label: 'Haftalık e-posta raporu',             free: false,   starter: false,   pro: true    },
  { label: 'Öncelikli destek',                    free: false,   starter: false,   pro: true    },
  { label: 'Rakip takibi',                        free: false,   starter: false,   pro: true    },
];

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'Ücretsiz plandan Başlangıç veya Pro\'ya geçince verilerim kalır mı?',
    a: 'Evet, tüm analizleriniz ve verileriniz eksiksiz korunur. Plan yükseltmesi mevcut verilerinizi hiçbir şekilde etkilemez.',
  },
  {
    q: 'İptal etmek için ne yapmalıyım?',
    a: 'İstediğiniz zaman ayarlar sayfasından aboneliğinizi iptal edebilirsiniz. İptal sonrası dönem sonuna kadar plan özelliklerini kullanmaya devam edersiniz.',
  },
  {
    q: 'Ödeme güvenli mi?',
    a: 'Ödemeler PayTR güvencesiyle gerçekleştirilir. Kart bilgileriniz Kârnet sunucularında saklanmaz; doğrudan PayTR\'ın PCI-DSS sertifikalı altyapısında işlenir.',
  },
  {
    q: 'Başlangıç\'tan Pro\'ya geçebilir miyim?',
    a: 'Evet, mevcut dönem sonunda veya hemen yükselterek Pro planına geçebilirsiniz. Ayarlar sayfasından plan yönetimine ulaşabilirsiniz.',
  },
  {
    q: '7 gün iade garantisi nasıl çalışır?',
    a: 'Satın alma tarihinden itibaren 7 gün içinde, herhangi bir gerekçe göstermeksizin destek ekibimizden tam iade talep edebilirsiniz.',
  },
];

// ─── sub-components ───────────────────────────────────────────────────────────

function CellValue({ val }: { val: string | boolean }) {
  if (val === true)  return <Check className="h-5 w-5 text-emerald-500 mx-auto" />;
  if (val === false) return <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
  return <span className="text-sm font-medium">{val}</span>;
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left gap-4 hover:text-primary transition-colors"
      >
        <span className="font-medium text-sm sm:text-base">{q}</span>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <p className="pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
      )}
    </div>
  );
}

// ─── inner page (uses useSearchParams — wrapped in Suspense below) ────────────

function PricingContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingCycle>(
    searchParams.get('billing') === 'yearly' ? 'yearly' : 'monthly',
  );
  const [loadingPro, setLoadingPro] = useState(false);
  const [loadingStarter, setLoadingStarter] = useState(false);

  const isAnnual = billing === 'yearly';
  const paymentStatus = searchParams.get('payment'); // 'success' | 'fail' | null
  const [pollState, setPollState] = useState<'idle' | 'polling' | 'active' | 'pending'>('idle');
  const [pollCount, setPollCount] = useState(0);

  const refreshProfile = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/user/profile', { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) return false;
      const data = await res.json();
      const plan = data?.plan || data?.profile?.plan || '';
      return plan === 'pro' || plan.startsWith('pro_') || plan === 'starter' || plan.startsWith('starter_');
    } catch {
      return false;
    }
  }, []);

  // Poll for plan activation after successful payment
  useEffect(() => {
    if (paymentStatus !== 'success' || !user) return;
    if (pollState !== 'idle') return;
    if (isProUser(user) || isStarterUser(user)) { setPollState('active'); toast.success('Planınız zaten aktif!'); return; }

    setPollState('polling');
    toast.success('Ödeme başarılı ✅ Planınız kontrol ediliyor...');
    let attempt = 0;
    const poll = async () => {
      attempt++;
      setPollCount(attempt);
      const isActive = await refreshProfile();
      if (isActive) {
        setPollState('active');
        toast.success('Planınız aktif edildi!');
        setTimeout(() => window.location.href = '/pricing', 1500);
        return;
      }
      if (attempt < 6) setTimeout(poll, 5000);
      else setPollState('pending');
    };
    setTimeout(poll, 3000);
  }, [paymentStatus, user, pollState, refreshProfile]);

  useEffect(() => {
    if (paymentStatus === 'fail') toast.error('Ödeme başarısız ❌ Tekrar deneyebilirsiniz.');
  }, [paymentStatus]);

  const handleUpgrade = async (planType: 'pro_monthly' | 'pro_yearly') => {
    if (!user) { window.location.href = '/auth'; return; }
    setLoadingPro(true);
    try {
      const res = await fetch('/api/paytr/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planType }),
      });
      const data = await res.json();
      if (data.paymentUrl) {
        window.open(data.paymentUrl, '_blank');
        // Token URL'de gosterilmez — guvenlik riski (referer header, browser history)
        const params = new URLSearchParams({ paymentId: data.paymentId });
        window.location.href = `/basari?${params.toString()}`;
      } else {
        toast.error(data.error || 'Ödeme başlatılamadı.');
        setLoadingPro(false);
      }
    } catch {
      setLoadingPro(false);
    }
  };

  // NOTE: Starter payments require create-payment route to accept 'starter_monthly'/'starter_yearly'.
  // Currently that route only accepts pro plans. Wire this up when the route is updated.
  const handleStarterUpgrade = async () => {
    if (!user) { window.location.href = '/auth'; return; }
    setLoadingStarter(true);
    try {
      const planType = isAnnual ? 'starter_yearly' : 'starter_monthly';
      const res = await fetch('/api/paytr/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planType }),
      });
      const data = await res.json();
      if (data.paymentUrl) {
        window.open(data.paymentUrl, '_blank');
        const params = new URLSearchParams({ paymentId: data.paymentId });
        window.location.href = `/basari?${params.toString()}`;
      } else {
        toast.error(data.error || 'Ödeme başlatılamadı.');
        setLoadingStarter(false);
      }
    } catch {
      setLoadingStarter(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 space-y-20">

        {/* ─ Payment Return Banners ─────────────────────────────────────────── */}
        {paymentStatus === 'success' && (
          <div className={cn(
            'mx-auto max-w-2xl rounded-xl border p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-4',
            pollState === 'active'
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-amber-500/10 border-amber-500/20',
          )}>
            {pollState === 'active' ? (
              <><CheckCircle2 className="h-6 w-6 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <div><p className="font-semibold text-emerald-700 dark:text-emerald-400">Plan Aktif ✅</p>
                  <p className="text-sm text-emerald-500">Planınız başarıyla aktif edildi!</p></div></>
            ) : pollState === 'pending' ? (
              <><Loader2 className="h-6 w-6 text-amber-700 dark:text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-700 dark:text-amber-400">Ödeme Alındı ⏳</p>
                  <p className="text-sm text-amber-500">30 saniye içinde otomatik aktif olur.</p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={async () => {
                  setPollState('polling'); setPollCount(0);
                  const isActive = await refreshProfile();
                  if (isActive) { setPollState('active'); toast.success('Plan aktif ✅'); setTimeout(() => window.location.href = '/pricing', 1500); }
                  else { setPollState('pending'); toast.info('Henüz aktif değil, biraz daha bekleyin.'); }
                }}>
                  <RefreshCw className="h-4 w-4 mr-1" />Yenile
                </Button></>
            ) : (
              <><Loader2 className="h-6 w-6 text-amber-700 dark:text-amber-400 animate-spin shrink-0" />
                <div><p className="font-semibold text-amber-700 dark:text-amber-400">Ödeme Başarılı ✅</p>
                  <p className="text-sm text-amber-500">Planınız kontrol ediliyor… ({pollCount}/6)</p></div></>
            )}
          </div>
        )}
        {paymentStatus === 'fail' && (
          <div className="mx-auto max-w-2xl rounded-xl border border-red-500/20 bg-red-500/10 p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <XCircle className="h-6 w-6 text-red-400 shrink-0" />
            <div><p className="font-semibold text-red-400">Ödeme Başarısız ❌</p>
              <p className="text-sm text-red-500">Ödeme tamamlanamadı. Tekrar deneyebilirsiniz.</p></div>
          </div>
        )}

        {/* ─ Header ────────────────────────────────────────────────────────── */}
        <div className="text-center space-y-3">
          <span className="inline-block mb-1 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            Fiyatlandırma
          </span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl font-geist">
            Sade ve Şeffaf Fiyatlandırma
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Gizli ücret yok. İstediğin zaman iptal et.
          </p>
        </div>

        {/* ─ Plan Cards — PricingSection ───────────────────────────────────── */}
        {(() => {
          const freeTier: PricingTier = {
            name: 'Ücretsiz',
            price: { monthly: 0, yearly: 0 },
            description: 'Yeni başlayanlar ve denemek isteyenler için.',
            icon: <span className="text-xl">🚀</span>,
            actionLabel: 'Ücretsiz Başla',
            onAction: () => { window.location.href = user ? '/dashboard' : '/auth'; },
            features: [
              { name: `${FREE_LIMIT} ürüne kadar analiz`, description: 'Kayıt edilebilir ürün sayısı', included: true },
              { name: 'Temel kâr hesaplama', description: 'Komisyon, kargo, KDV dahil', included: true },
              { name: 'PRO Muhasebe Modu', description: 'Başlangıç ve üstü planlarda', included: false },
              { name: 'CSV içe / dışa aktarma', description: 'Başlangıç ve üstü planlarda', included: false },
              { name: 'Hassasiyet analizi', description: 'Başlangıç ve üstü planlarda', included: false },
              { name: 'Pazaryeri karşılaştırması', description: 'Pro planında aktif', included: false },
              { name: 'Nakit akışı tahmini', description: 'Pro planında aktif', included: false },
            ],
          };

          const currentUserIsStarter = user && isStarterUser(user);
          const starterTier: PricingTier = {
            name: 'Başlangıç',
            price: { monthly: STARTER_MONTHLY, yearly: STARTER_YEARLY },
            description: 'Küçük ve orta ölçekli satıcılar için.',
            highlight: true,
            badge: 'EN POPÜLER',
            icon: <Zap className="h-5 w-5" />,
            actionLabel: currentUserIsStarter ? 'Mevcut Plan' : 'Başlangıç\'a Geç',
            onAction: currentUserIsStarter ? undefined : handleStarterUpgrade,
            features: [
              { name: `${STARTER_LIMIT} ürüne kadar analiz`, description: 'Kayıt edilebilir ürün sayısı', included: true },
              { name: 'PRO Muhasebe Modu', description: 'KDV ayrıştırma, net kâr', included: true },
              { name: 'Hassasiyet analizi', description: 'Senaryo bazlı projeksiyon', included: true },
              { name: 'Başa-baş noktası analizi', description: 'Break-even hesaplama', included: true },
              { name: 'CSV içe / dışa aktarma', description: 'Excel ile tam entegrasyon', included: true },
              { name: 'PDF rapor (5 adet/ay)', description: 'Aylık 5 rapor', included: true },
              { name: 'Pazaryeri karşılaştırması', description: 'Pro planında aktif', included: false },
              { name: 'Nakit akışı & API entegrasyonu', description: 'Pro planında aktif', included: false },
            ],
          };

          const currentUserIsPro = user && isProUser(user);
          const proTier: PricingTier = {
            name: 'Profesyonel',
            price: { monthly: PRO_MONTHLY, yearly: PRO_YEARLY },
            description: 'Büyük ölçekli ve profesyonel satıcılar için.',
            icon: <Crown className="h-5 w-5" />,
            actionLabel: currentUserIsPro ? 'Mevcut Plan' : 'Pro\'ya Geç',
            onAction: currentUserIsPro ? undefined : () => handleUpgrade(isAnnual ? 'pro_yearly' : 'pro_monthly'),
            features: [
              { name: 'Sınırsız ürün analizi', description: 'Dilediğiniz kadar analiz', included: true },
              { name: 'Pazaryeri karşılaştırması', description: 'Trendyol vs HB vs Amazon', included: true },
              { name: 'Nakit akışı tahmini', description: 'Aylık cashflow projeksiyonu', included: true },
              { name: 'API entegrasyonu', description: 'Trendyol & Hepsiburada', included: true },
              { name: 'Sınırsız PDF rapor', description: 'İstediğin kadar rapor', included: true },
              { name: 'Haftalık e-posta raporu', description: 'Otomatik haftalık özet', included: true },
              { name: 'Rakip takibi', description: 'Otomatik fiyat izleme', included: true },
              { name: 'Öncelikli destek', description: 'Hızlı yanıt garantisi', included: true },
            ],
          };

          return (
            <PricingSection
              tiers={[freeTier, starterTier, proTier]}
              className="!py-0"
              onBillingChange={(isYearly) => setBilling(isYearly ? 'yearly' : 'monthly')}
            />
          );
        })()}

        {/* ─ Comparison Table ───────────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Özellik Karşılaştırması</h2>
          <div className="rounded-2xl border border-border/40 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-4 bg-muted/10 border-b border-border/40">
              <div className="p-4 text-sm font-semibold text-muted-foreground">Özellik</div>
              <div className="p-4 text-sm font-semibold text-center border-l border-border/40">Ücretsiz</div>
              <div className="p-4 text-sm font-semibold text-center border-l border-border/40 text-amber-700 dark:text-amber-400">Başlangıç</div>
              <div className="p-4 text-sm font-semibold text-center border-l border-border/40 text-amber-700 dark:text-amber-400">Pro</div>
            </div>
            {/* Rows */}
            {COMPARISON_ROWS.map((row, i) => (
              <div key={row.label} className={cn('grid grid-cols-4 border-b border-border/30 last:border-b-0', i % 2 === 0 ? 'bg-transparent' : 'bg-muted/10')}>
                <div className="p-3.5 text-sm text-foreground/80">{row.label}</div>
                <div className="p-3.5 text-center border-l border-border/40 flex items-center justify-center">
                  <CellValue val={row.free} />
                </div>
                <div className="p-3.5 text-center border-l border-border/40 flex items-center justify-center">
                  <CellValue val={row.starter} />
                </div>
                <div className="p-3.5 text-center border-l border-border/40 flex items-center justify-center">
                  <CellValue val={row.pro} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─ Trust Bar ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <span>PayTR güvencesi</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-500" />
            <span>Kart bilginiz saklanmaz</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-500" />
            <span>7 gün iade garantisi</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-500" />
            <span>İstediğiniz zaman iptal</span>
          </div>
        </div>

        {/* ─ FAQ ────────────────────────────────────────────────────────────── */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Sıkça Sorulan Sorular</h2>
          <div className="rounded-2xl border border-border/40 bg-card p-6 divide-y divide-border/40">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>

        {/* ─ Bottom CTA ─────────────────────────────────────────────────────── */}
        <div className="text-center space-y-5 py-8">
          <h2 className="text-2xl font-bold">Hâlâ kararsız mısın?</h2>
          <p className="text-muted-foreground">
            Ücretsiz planla başla, istediğinde yükselt.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button variant="outline" size="lg" className="rounded-xl h-12 px-8" asChild>
              <a href={user ? '/dashboard' : '/auth'}>
                Ücretsiz Başla
              </a>
            </Button>
            {!(user && isProUser(user)) && (
              <Button
                size="lg"
                className="rounded-xl h-12 px-8 text-white"
                style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}
                onClick={() => handleUpgrade(isAnnual ? 'pro_yearly' : 'pro_monthly')}
                disabled={loadingPro || loadingStarter}
              >
                {loadingPro
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Yönlendiriliyor…</>
                  : "Pro'ya Geç →"}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Güvenli ödeme · PayTR altyapısı · Kart bilgisi saklanmaz
          </p>
        </div>

      </div>
      <Footer />
    </div>
  );
}

// ─── page export with Suspense (fixes useSearchParams blank render) ────────────

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <PricingContent />
    </Suspense>
  );
}
