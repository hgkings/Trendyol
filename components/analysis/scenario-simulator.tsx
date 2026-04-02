'use client';

import { useState } from 'react';
import { ProductInput } from '@/types';
import { calculateProfit } from '@/utils/calculations';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { formatCurrency, formatPercent } from '@/components/shared/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity } from 'lucide-react';

interface ScenarioSimulatorProps {
    input: ProductInput;
}

export function ScenarioSimulator({ input }: ScenarioSimulatorProps) {
    // Simulation Deltas (Changes from base)
    const [returnRateDelta, setReturnRateDelta] = useState(0); // Additive %
    const [adCostDelta, setAdCostDelta] = useState(0); // Additive currency
    const [commissionDelta, setCommissionDelta] = useState(0); // Additive %

    const simulatedInput = {
        ...input,
        return_rate_pct: Math.max(0, input.return_rate_pct + returnRateDelta),
        ad_cost_per_sale: Math.max(0, input.ad_cost_per_sale + adCostDelta),
        commission_pct: Math.max(0, input.commission_pct + commissionDelta),
    };

    const originalResult = calculateProfit(input);
    const simulatedResult = calculateProfit(simulatedInput);

    const profitDiff = simulatedResult.monthly_net_profit - originalResult.monthly_net_profit;
    const marginDiff = simulatedResult.margin_pct - originalResult.margin_pct;

    const resetSimulation = () => {
        setReturnRateDelta(0);
        setAdCostDelta(0);
        setCommissionDelta(0);
    };

    const applyScenario = (type: 'optimistic' | 'pessimistic') => {
        if (type === 'optimistic') {
            const currentReturn = input.return_rate_pct;
            // Reduce return rate by 2% if possible
            setReturnRateDelta(currentReturn >= 2 ? -2 : -currentReturn);
            const currentAd = input.ad_cost_per_sale;
            // Reduce ad cost by 20%
            setAdCostDelta(-currentAd * 0.2);
            setCommissionDelta(0);
        } else {
            setReturnRateDelta(5); // Increase return rate by 5%
            setAdCostDelta(input.ad_cost_per_sale * 0.2); // Increase ad cost by 20%
            setCommissionDelta(0);
        }
    };

    return (
        <Card className="shadow-sm border">
            <CardHeader className="pb-3 border-b border-border/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-base font-bold">Senaryo Simülatörü</CardTitle>
                            <p className="text-xs text-muted-foreground">Parametreleri değiştirerek kârlılık üzerindeki etkiyi analiz et.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Badge
                            variant="outline"
                            className="cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                            onClick={() => applyScenario('optimistic')}
                        >
                            İyi senaryo
                        </Badge>
                        <Badge
                            variant="outline"
                            className="cursor-pointer bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400"
                            onClick={() => applyScenario('pessimistic')}
                        >
                            Kötü senaryo
                        </Badge>
                        <Badge
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={resetSimulation}
                        >
                            Sıfırla
                        </Badge>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-6 grid gap-8 lg:grid-cols-12 min-w-0">
                {/* Controls (Left - 7 cols) */}
                <div className="space-y-8 lg:col-span-7 border-r lg:pr-8 border-border/50">
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-sm font-medium">İade Oranı Değişimi</Label>
                                <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${returnRateDelta > 0 ? 'bg-red-500/10 text-red-400' : returnRateDelta < 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                                    {returnRateDelta > 0 ? '+' : ''}{returnRateDelta}%
                                </span>
                            </div>
                            <Slider
                                value={[returnRateDelta]}
                                min={-10} max={20} step={0.5}
                                onValueChange={(v) => setReturnRateDelta(v[0])}
                                className="py-2"
                            />
                            <p className="text-[10px] text-muted-foreground text-right">Yeni İade Oranı: %{simulatedInput.return_rate_pct.toFixed(1)}</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-sm font-medium">Reklam Maliyeti (Birim)</Label>
                                <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${adCostDelta > 0 ? 'bg-red-500/10 text-red-400' : adCostDelta < 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                                    {adCostDelta > 0 ? '+' : ''}{formatCurrency(adCostDelta)}
                                </span>
                            </div>
                            <Slider
                                value={[adCostDelta]}
                                min={-50} max={100} step={1}
                                onValueChange={(v) => setAdCostDelta(v[0])}
                                className="py-2"
                            />
                            <p className="text-[10px] text-muted-foreground text-right">Yeni Reklam Maliyeti: {formatCurrency(simulatedInput.ad_cost_per_sale)}</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-sm font-medium">Komisyon Farkı</Label>
                                <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${commissionDelta > 0 ? 'bg-red-500/10 text-red-400' : commissionDelta < 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                                    {commissionDelta > 0 ? '+' : ''}{commissionDelta}%
                                </span>
                            </div>
                            <Slider
                                value={[commissionDelta]}
                                min={-5} max={10} step={0.1}
                                onValueChange={(v) => setCommissionDelta(v[0])}
                                className="py-2"
                            />
                            <p className="text-[10px] text-muted-foreground text-right">Yeni Komisyon: %{simulatedInput.commission_pct.toFixed(1)}</p>
                        </div>
                    </div>
                </div>

                {/* Results Comparison (Right - 5 cols) */}
                <div className="lg:col-span-5 flex flex-col gap-4 min-w-0">

                    {/* Main Profit Card */}
                    <div className="rounded-lg border border-border/30 bg-muted/50 p-4">
                        <p className="text-xs font-medium text-muted-foreground">Simüle edilen net kâr</p>
                        <div className="mt-2 min-w-0 overflow-hidden">
                            {/* Clamp font size: min 24px, preferred 3.5vw, max 40px */}
                            <p className="text-3xl font-bold tracking-tight text-foreground truncate" style={{ lineHeight: 1.1 }}>
                                {formatCurrency(simulatedResult.monthly_net_profit)}
                            </p>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground line-through opacity-60 px-1.5 py-0.5 bg-muted rounded">
                                {formatCurrency(originalResult.monthly_net_profit)}
                            </span>
                            <span className={`font-bold px-1.5 py-0.5 rounded ${profitDiff >= 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                {profitDiff > 0 ? '+' : ''}{formatCurrency(profitDiff)}
                            </span>
                        </div>
                    </div>

                    {/* Margin Card & Decision */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                        <div className="rounded-xl border border-border/40 bg-card p-4 flex flex-col justify-center">
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-xs font-medium text-muted-foreground">Simüle Marj</p>
                                <span className={`text-xs font-bold ${marginDiff >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
                                    {marginDiff > 0 ? '+' : ''}{marginDiff.toFixed(1)}%
                                </span>
                            </div>
                            <p className="text-2xl font-bold tracking-tight">{formatPercent(simulatedResult.margin_pct)}</p>
                        </div>

                        <div className="rounded-xl border border-border/30 bg-muted/30 p-4 flex items-center justify-between gap-3">
                            <div>
                                {simulatedResult.monthly_net_profit < 0 ? (
                                    <Badge variant="destructive" className="mb-1">Riskli</Badge>
                                ) : simulatedResult.margin_pct < 10 ? (
                                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 mb-1">Dikkat</Badge>
                                ) : (
                                    <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/30 mb-1">Uygun</Badge>
                                )}
                                <p className="text-[10px] text-muted-foreground leading-tight">
                                    {profitDiff < 0 ? "Kâr düşüşü bekleniyor." : "Kâr artışı öngörülüyor."}
                                </p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={resetSimulation}>
                                    Sıfırla
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card >
    );
}
