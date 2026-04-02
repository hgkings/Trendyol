'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';

export function QuickCalc() {
    const [salePrice, setSalePrice] = useState(350);
    const [productCost, setProductCost] = useState(150);
    const [commissionPct, setCommissionPct] = useState(21);

    const result = useMemo(() => {
        if (salePrice <= 0 || productCost <= 0) return null;

        const commission = salePrice * (commissionPct / 100);
        const shippingEstimate = 35;
        const vatEstimate = salePrice * 0.20 * 0.10;
        const netProfit = salePrice - productCost - commission - shippingEstimate - vatEstimate;
        const margin = (netProfit / salePrice) * 100;

        return {
            netProfit: Math.round(netProfit * 100) / 100,
            margin: Math.round(margin * 10) / 10,
        };
    }, [salePrice, productCost, commissionPct]);

    const isProfitable = result && result.netProfit > 0;

    return (
        <section className="py-16 sm:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-3xl">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium backdrop-blur-sm mb-4 bg-amber-500/12 text-amber-800 dark:text-amber-300">
                            <Calculator className="h-3.5 w-3.5" />
                            <span>Hızlı Hesap</span>
                        </div>
                        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ letterSpacing: '-0.5px' }}>
                            Şimdi deneyin — hesap gerekmez
                        </h2>
                    </div>

                    <div className="rounded-2xl border border-border/40 bg-card p-6 sm:p-8">
                        <div className="grid gap-6 sm:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="qc-sale" className="text-xs font-medium text-muted-foreground mb-1.5">Satış Fiyatı</Label>
                                <div className="relative">
                                    <Input
                                        id="qc-sale"
                                        type="number"
                                        value={salePrice}
                                        onChange={(e) => setSalePrice(Number(e.target.value))}
                                        className="h-11 pr-8 bg-muted/20 border-border/60 rounded-[10px] focus:border-amber-500 focus:ring-1 focus:ring-amber-500/10"
                                        min={0}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">₺</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="qc-cost" className="text-xs font-medium text-muted-foreground mb-1.5">Ürün Maliyeti</Label>
                                <div className="relative">
                                    <Input
                                        id="qc-cost"
                                        type="number"
                                        value={productCost}
                                        onChange={(e) => setProductCost(Number(e.target.value))}
                                        className="h-11 pr-8 bg-muted/20 border-border/60 rounded-[10px] focus:border-amber-500 focus:ring-1 focus:ring-amber-500/10"
                                        min={0}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">₺</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="qc-comm" className="text-xs font-medium text-muted-foreground mb-1.5">Komisyon</Label>
                                <div className="relative">
                                    <Input
                                        id="qc-comm"
                                        type="number"
                                        value={commissionPct}
                                        onChange={(e) => setCommissionPct(Number(e.target.value))}
                                        className="h-11 pr-8 bg-muted/20 border-border/60 rounded-[10px] focus:border-amber-500 focus:ring-1 focus:ring-amber-500/10"
                                        min={0}
                                        max={100}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">%</span>
                                </div>
                            </div>
                        </div>

                        {/* Result */}
                        {result && (
                            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-4">
                                <div className="flex items-center gap-4">
                                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isProfitable ? 'bg-emerald-500/12' : 'bg-red-500/12'}`}>
                                        {isProfitable
                                            ? <TrendingUp className="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
                                            : <TrendingDown className="h-6 w-6 text-red-400" />
                                        }
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Tahmini Net Kâr (birim)</p>
                                        <p className={`text-2xl font-bold tabular-nums tracking-tight ${isProfitable ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
                                            ₺{result.netProfit.toLocaleString('tr-TR')}
                                        </p>
                                    </div>
                                    <div className="hidden sm:block h-10 w-px bg-border/40 mx-2" />
                                    <div className="hidden sm:block">
                                        <p className="text-xs text-muted-foreground">Marj</p>
                                        <p className={`text-lg font-bold tabular-nums ${isProfitable ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
                                            %{result.margin}
                                        </p>
                                    </div>
                                </div>
                                <Link href="/demo">
                                    <Button size="sm" className="gap-2 rounded-xl shadow-sm text-white" style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}>
                                        Detaylı Analiz
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        )}

                        <p className="mt-4 text-center text-[11px] text-muted-foreground/60">
                            * Tahmini hesaplama. Kargo (₺35) ve basitleştirilmiş KDV dahildir. Kesin sonuç için detaylı analiz yapın.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
