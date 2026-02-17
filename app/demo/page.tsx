'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AnalysisForm } from '@/components/analysis/analysis-form';
import {
    TrendingUp,
    ArrowLeft,
    Sparkles,
    Shield,
    Zap,
    UserPlus,
} from 'lucide-react';

export default function DemoPage() {
    const initialData = {
        marketplace: 'trendyol' as const,
        product_name: 'Örnek Tişört (Demo)',
        monthly_sales_volume: 50,
        product_cost: 150,
        sale_price: 350,
        commission_pct: 21,
        shipping_cost: 35,
        packaging_cost: 5,
        ad_cost_per_sale: 20,
        return_rate_pct: 3,
        other_cost: 0,
        payout_delay_days: 14,
        vat_pct: 20,
        shipping_includes_vat: true,
        packaging_includes_vat: true,
        ad_includes_vat: true,
        other_cost_includes_vat: true,
        category: 'Giyim',
        target_profit_margin: 20,
    };

    return (
        <div className="min-h-screen bg-background">
            {/* ── Sticky Header ── */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl">
                <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <Link href="/">
                            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2">
                                <ArrowLeft className="h-4 w-4" />
                                <span className="hidden sm:inline">Ana Sayfa</span>
                            </Button>
                        </Link>

                        <div className="h-4 w-px bg-border" />

                        <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                                <TrendingUp className="h-3.5 w-3.5 text-primary-foreground" />
                            </div>
                            <span className="text-sm font-semibold tracking-tight">Kârnet</span>
                            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">Demo</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="hidden md:inline-block text-[11px] text-muted-foreground">
                            Hesaplama sonuçları kaydedilmez
                        </span>
                        <Link href="/auth">
                            <Button size="sm" className="gap-1.5 rounded-[10px] shadow-premium-sm text-xs h-8">
                                <UserPlus className="h-3.5 w-3.5" />
                                Ücretsiz Kayıt
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

                {/* ── Hero Banner ── */}
                <div className="relative mb-8 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/[0.04] via-card to-card p-6 sm:p-8">
                    {/* Ambient glow */}
                    <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/10 blur-[60px]" />
                    <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-blue-500/8 blur-[40px]" />

                    <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-2 max-w-lg">
                            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                                Kâr Analizi Simülasyonu
                            </h1>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Değerleri değiştirerek kârlılığınızı anlık test edin.
                                Kayıt olmadan tüm hesaplama özelliklerini deneyin.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {[
                                { icon: Zap, text: 'Anlık hesaplama' },
                                { icon: Shield, text: 'Veri kaydedilmez' },
                                { icon: Sparkles, text: '8+ gider kalemi' },
                            ].map((chip) => (
                                <div
                                    key={chip.text}
                                    className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm"
                                >
                                    <chip.icon className="h-3 w-3 text-primary" />
                                    {chip.text}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Analysis Form ── */}
                <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                    <AnalysisForm initialData={initialData} isDemo={true} />
                </div>

                {/* ── Bottom CTA ── */}
                <div className="mt-8 rounded-2xl border bg-gradient-to-r from-primary/5 via-card to-card p-6 sm:p-8 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="space-y-1">
                            <p className="text-sm font-semibold">Sonuçları kaydetmek ister misiniz?</p>
                            <p className="text-xs text-muted-foreground">
                                Ücretsiz hesap ile 5 ürüne kadar analiz kaydedebilir, PDF rapor alabilirsiniz.
                            </p>
                        </div>
                        <Link href="/auth">
                            <Button className="gap-2 rounded-[10px] shadow-premium-sm whitespace-nowrap">
                                <UserPlus className="h-4 w-4" />
                                Ücretsiz Hesap Oluştur
                            </Button>
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
