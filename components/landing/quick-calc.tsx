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
        // Simple assumptions for quick calc
        const shippingEstimate = 35;
        const vatEstimate = salePrice * 0.20 * 0.10; // simplified
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
                        <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3.5 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-sm shadow-sm mb-4">
                            <Calculator className="h-3.5 w-3.5 text-primary" />
                            <span>Hızlı Hesap</span>
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                            Şimdi deneyin — hesap gerekmez
                        </h2>
                    </div>

                    <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-premium-md">
                        <div className="grid gap-6 sm:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="qc-sale" className="text-sm font-medium">Satış Fiyatı</Label>
                                <div className="relative">
                                    <Input
                                        id="qc-sale"
                                        type="number"
                                        value={salePrice}
                                        onChange={(e) => setSalePrice(Number(e.target.value))}
                                        className="h-11 pr-8"
                                        min={0}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₺</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="qc-cost" className="text-sm font-medium">Ürün Maliyeti</Label>
                                <div className="relative">
                                    <Input
                                        id="qc-cost"
                                        type="number"
                                        value={productCost}
                                        onChange={(e) => setProductCost(Number(e.target.value))}
                                        className="h-11 pr-8"
                                        min={0}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₺</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="qc-comm" className="text-sm font-medium">Komisyon</Label>
                                <div className="relative">
                                    <Input
                                        id="qc-comm"
                                        type="number"
                                        value={commissionPct}
                                        onChange={(e) => setCommissionPct(Number(e.target.value))}
                                        className="h-11 pr-8"
                                        min={0}
                                        max={100}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                                </div>
                            </div>
                        </div>

                        {/* Result */}
                        {result && (
                            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border bg-muted/30 p-4">
                                <div className="flex items-center gap-4">
                                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isProfitable ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                                        {isProfitable
                                            ? <TrendingUp className="h-6 w-6 text-emerald-600" />
                                            : <TrendingDown className="h-6 w-6 text-red-500" />
                                        }
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Tahmini Net Kâr (birim)</p>
                                        <p className={`text-2xl font-bold tabular-nums tracking-tight ${isProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                            ₺{result.netProfit.toLocaleString('tr-TR')}
                                        </p>
                                    </div>
                                    <div className="hidden sm:block h-10 w-px bg-border mx-2" />
                                    <div className="hidden sm:block">
                                        <p className="text-xs text-muted-foreground">Marj</p>
                                        <p className={`text-lg font-bold tabular-nums ${isProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                            %{result.margin}
                                        </p>
                                    </div>
                                </div>
                                <Link href="/demo">
                                    <Button size="sm" className="gap-2 rounded-[10px] shadow-premium-sm">
                                        Detaylı Analiz
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        )}

                        <p className="mt-4 text-center text-[11px] text-muted-foreground">
                            * Tahmini hesaplama. Kargo (₺35) ve basitleştirilmiş KDV dahildir. Kesin sonuç için detaylı analiz yapın.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
