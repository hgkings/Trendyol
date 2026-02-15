'use client';

import { useAuth } from '@/contexts/auth-context';
import { Navbar } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Check, X, Crown, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { PLAN_LIMITS } from '@/config/plans';
import { PRICING } from '@/config/pricing';
import { isProUser } from '@/utils/access';

export default function PricingPage() {
  const { user, upgradePlan } = useAuth();
  const [isAnnual, setIsAnnual] = useState(false);

  const FREE_LIMIT = PLAN_LIMITS.free.maxProducts;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mx-auto max-w-3xl text-center space-y-4 mb-16">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Basit ve Şeffaf Fiyatlandırma
          </h1>
          <p className="text-lg text-muted-foreground">
            Profesyonel satıcılar için tasarlandı. Sürpriz ücret yok.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center mt-8">
            <div className="relative flex items-center bg-muted p-1 rounded-xl border">
              <button
                onClick={() => setIsAnnual(false)}
                className={cn(
                  "px-6 py-2.5 text-sm font-medium rounded-[10px] transition-all duration-200",
                  !isAnnual
                    ? "bg-card text-foreground shadow-premium-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Aylık
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={cn(
                  "px-6 py-2.5 text-sm font-medium rounded-[10px] transition-all duration-200 relative",
                  isAnnual
                    ? "bg-card text-foreground shadow-premium-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Yıllık
                <span className="absolute -top-2.5 -right-3 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm border border-white/20 font-semibold tracking-wide transform rotate-3">
                  %20
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-4xl mx-auto">

          {/* FREE */}
          <div className="relative rounded-2xl border bg-card p-8 shadow-premium-sm hover:shadow-premium-md transition-shadow duration-300 flex flex-col">
            <div className="mb-6">
              <h3 className="text-xl font-bold">Ücretsiz</h3>
              <p className="text-sm text-muted-foreground mt-2 min-h-[40px]">
                Yeni başlayanlar ve denemek isteyenler için ideal.
              </p>
            </div>

            <div className="mb-8">
              <span className="text-4xl font-bold">0₺</span>
              <span className="text-muted-foreground ml-1">/ ay</span>
            </div>

            <div className="space-y-4 flex-1">
              <FeatureItem text={`Maksimum ${FREE_LIMIT} Ürün Analizi`} included />
              <FeatureItem text="Temel Kâr Hesaplama" included />
              <FeatureItem text="Risk Puanı Görüntüleme" included />
              <FeatureItem text="JSON Dışa Aktarma" included />
              <FeatureItem text="Profesyonel Muhasebe Modu" included={false} />
              <FeatureItem text="Sınırsız Analiz" included={false} />
              <FeatureItem text="CSV İçe/Dışa Aktarma" included={false} />
              <FeatureItem text="Yazdırılabilir Rapor" included={false} />
            </div>

            <div className="mt-8 pt-6 border-t">
              {user && user.plan === 'free' ? (
                <Button variant="outline" className="w-full h-12 rounded-xl text-base font-medium" disabled>
                  Mevcut Plan
                </Button>
              ) : (
                <Button variant="outline" className="w-full h-12 rounded-xl text-base font-medium hover:bg-muted/50" asChild>
                  <a href={user ? '/dashboard' : '/auth'}>
                    {user ? 'Panele Git' : 'Ücretsiz Başla'}
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* PRO */}
          <div className="relative rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-primary/[0.03] to-card p-8 shadow-premium-lg hover:scale-[1.02] transition-all duration-300 flex flex-col">
            {/* Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary via-blue-600 to-primary text-primary-foreground px-5 py-2 rounded-full text-xs font-bold shadow-premium-md flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 fill-current" />
              EN ÇOK TERCİH EDİLEN
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                Pro
                <Crown className="h-5 w-5 text-primary fill-current" />
              </h3>
              <p className="text-sm text-muted-foreground mt-2 min-h-[40px]">
                Ciddi satıcılar ve büyümek isteyenler için tüm özellikler.
              </p>
            </div>

            <div className="mb-8">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Normal Fiyat</span>
                    <span className="text-xl text-muted-foreground/80 font-bold line-through decoration-red-500/50 decoration-2">
                      {isAnnual ? `${PRICING.oldMonthly * 10}₺` : `${PRICING.oldMonthly}₺`}
                    </span>
                  </div>
                </div>

                {/* Current Price */}
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-foreground tracking-tight">
                    {isAnnual ? `${PRICING.yearly.toLocaleString('tr-TR')}` : `${PRICING.monthly}`}₺
                  </span>
                  <span className="text-base font-medium text-muted-foreground">
                    {isAnnual ? '/ yıl' : '/ ay'}
                  </span>
                  {/* Minimal Discount Chip */}
                  <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    %50 İndirim
                  </span>
                </div>

                {/* Founder Price Badge - Improved Readability */}
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 border border-amber-200/60 dark:border-amber-800/30 w-full group transition-all hover:bg-amber-100/50">
                  <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-amber-950/50 shadow-sm border border-amber-100">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 fill-current" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-amber-600/90 uppercase tracking-wider leading-none mb-0.5">Kurucu Üye Fırsatı</span>
                    <p className="text-xs text-foreground/80 font-medium leading-tight">
                      Erken erişim süresince sabitlenen özel fiyat
                    </p>
                  </div>
                </div>
              </div>

              {isAnnual && (
                <p className="mt-3 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 inline-block px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                  🎉 2 Ay Bizden Hediye!
                </p>
              )}
            </div>

            <div className="space-y-4 flex-1">
              <FeatureItem text="Sınırsız Ürün Analizi" included highlight />
              <FeatureItem text="Profesyonel Muhasebe Modu (KDV Hariç Net)" included highlight />
              <FeatureItem text="Hassasiyet Analizi" included highlight />
              <FeatureItem text="CSV İçe & Dışa Aktarma" included highlight />
              <FeatureItem text="Nakit Akışı Tahmini" included highlight />
              <FeatureItem text="Pazaryeri Karşılaştırması" included highlight />
              <FeatureItem text="Yazdırılabilir PDF Rapor" included highlight />
              <FeatureItem text="Öncelikli Destek" included highlight />
            </div>

            <div className="mt-8 pt-6 border-t">
              {user && isProUser(user) ? (
                <div className="w-full h-12 flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20 font-medium">
                  <Check className="h-5 w-5" />
                  Pro Plan Aktif
                </div>
              ) : (
                <div className="space-y-3">
                  <Button
                    className="w-full h-14 rounded-xl text-lg font-bold bg-primary hover:bg-primary/90 shadow-premium-md hover:shadow-premium-lg hover:scale-[1.02] transition-all duration-300 active:scale-95"
                    onClick={async () => {
                      if (user) await upgradePlan();
                      else window.location.href = '/auth';
                    }}
                  >
                    {user ? "Pro'ya Yükselt" : "Pro ile Başla"}
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground">
                    7 gün içinde koşulsuz para iade garantisi
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        <p className="mt-16 text-center text-sm text-muted-foreground max-w-2xl mx-auto">
          Demo Modu: &quot;Pro&apos;ya Yükselt&quot; butonuna tıkladığınızda anında Pro özellikleri aktif edilir. Gerçek ödeme sistemi entegrasyonu için Stripe veya Iyzico yapılandırması gerekir.
        </p>

      </div>
    </div>
  );
}

function FeatureItem({ text, included, highlight = false }: { text: string; included: boolean; highlight?: boolean }) {
  return (
    <div className={cn("flex items-start gap-3", !included && "opacity-40")}>
      <div className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5",
        included
          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-muted text-muted-foreground"
      )}>
        {included ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </div>
      <span className={cn(
        "text-sm leading-6",
        included && highlight ? "font-medium text-foreground" : "text-muted-foreground"
      )}>
        {text}
      </span>
    </div>
  );
}
