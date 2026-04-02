'use client';

import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/components/shared/format';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import {
    Calculator, Target, TrendingUp, Save, Info,
    ShoppingCart, Banknote, ArrowRight, Lightbulb,
    AlertTriangle, ArrowUpRight, ArrowDownRight, Calendar,
    Percent, Package, Zap, BarChart3
} from 'lucide-react';
import { UpgradeModal } from '@/components/shared/upgrade-modal';
import { isProUser } from '@/utils/access';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer,
    ReferenceDot, Area, AreaChart, ReferenceLine
} from 'recharts';

// ─── Chart Tooltip ──────────────────────────────────────────────────
function ChartTooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-border/50 bg-card px-4 py-3 shadow-md">
            <p className="text-xs font-medium text-muted-foreground mb-2">{label} siparis</p>
            {payload.map((entry, i) => (
                <div key={i} className="flex items-center justify-between gap-6 text-sm">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                        <span className="text-foreground/80">
                            {entry.dataKey === 'revenue' ? 'Gelir' : entry.dataKey === 'totalCost' ? 'Toplam Maliyet' : entry.dataKey === 'profit' ? 'Kar' : entry.dataKey}
                        </span>
                    </span>
                    <span className={`font-bold tabular-nums ${entry.dataKey === 'profit' && entry.value < 0 ? 'text-red-400' : ''}`}>
                        {formatCurrency(entry.value)}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════
export default function BreakEvenPage() {
    const { user, updateProfile } = useAuth();
    const [showUpgrade, setShowUpgrade] = useState(false);

    useEffect(() => {
        if (user && !isProUser(user)) setShowUpgrade(true);
    }, [user]);

    // ─── Core state ─────────────────────────────────────────────────
    const [avgPrice, setAvgPrice] = useState<number>(0);
    const [avgVarCost, setAvgVarCost] = useState<number>(0);
    const [fixedCost, setFixedCost] = useState<number>(0);
    const [targetProfit, setTargetProfit] = useState<number>(0);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // ─── Sensitivity slider ────────────────────────────────────────
    const [priceAdj, setPriceAdj] = useState(0); // -30% to +30%

    // ─── Init from profile + localStorage ──────────────────────────
    useEffect(() => {
        if (user) {
            if (user.fixed_cost_monthly) setFixedCost(user.fixed_cost_monthly);
            if (user.target_profit_monthly) setTargetProfit(user.target_profit_monthly);
        }
    }, [user]);

    useEffect(() => {
        const savedPrice = localStorage.getItem('be_avgPrice');
        const savedVarCost = localStorage.getItem('be_avgVarCost');
        if (savedPrice) setAvgPrice(parseFloat(savedPrice));
        if (savedVarCost) setAvgVarCost(parseFloat(savedVarCost));
    }, []);

    const updateLocalPrice = (val: number) => {
        setAvgPrice(val);
        localStorage.setItem('be_avgPrice', val.toString());
        setHasChanges(true);
    };
    const updateLocalVarCost = (val: number) => {
        setAvgVarCost(val);
        localStorage.setItem('be_avgVarCost', val.toString());
        setHasChanges(true);
    };

    // ─── Calculations ──────────────────────────────────────────────
    const adjPrice = avgPrice * (1 + priceAdj / 100);
    const contribution = adjPrice - avgVarCost;
    const isValidContribution = contribution > 0;
    const contributionMargin = adjPrice > 0 ? (contribution / adjPrice) * 100 : 0;

    const breakEvenOrders = isValidContribution ? Math.ceil(fixedCost / contribution) : 0;
    const breakEvenRevenue = breakEvenOrders * adjPrice;

    const targetOrders = isValidContribution ? Math.ceil((fixedCost + targetProfit) / contribution) : 0;
    const targetRevenue = targetOrders * adjPrice;

    const dailyTargetOrders = Math.ceil(targetOrders / 30);
    const dailyTargetRevenue = dailyTargetOrders * adjPrice;
    const dailyBreakEvenOrders = Math.ceil(breakEvenOrders / 30);

    // ─── Chart data ─────────────────────────────────────────────────
    const chartData = useMemo(() => {
        if (!isValidContribution || breakEvenOrders === 0) return [];
        const maxOrders = Math.max(targetOrders, breakEvenOrders) * 1.5;
        const step = Math.max(1, Math.floor(maxOrders / 20));
        const points = [];
        for (let q = 0; q <= maxOrders; q += step) {
            points.push({
                orders: q,
                revenue: q * adjPrice,
                totalCost: fixedCost + q * avgVarCost,
                profit: q * adjPrice - (fixedCost + q * avgVarCost),
            });
        }
        return points;
    }, [adjPrice, avgVarCost, fixedCost, isValidContribution, breakEvenOrders, targetOrders]);

    // ─── Sensitivity data ───────────────────────────────────────────
    const sensitivityData = useMemo(() => {
        const points = [];
        for (let adj = -30; adj <= 30; adj += 5) {
            const p = avgPrice * (1 + adj / 100);
            const c = p - avgVarCost;
            const be = c > 0 ? Math.ceil(fixedCost / c) : 0;
            points.push({ adj: `${adj >= 0 ? '+' : ''}${adj}%`, breakEven: be, isCurrent: adj === priceAdj });
        }
        return points;
    }, [avgPrice, avgVarCost, fixedCost, priceAdj]);

    // ─── Smart recommendations ──────────────────────────────────────
    const recommendations = useMemo(() => {
        const tips: Array<{ icon: typeof Lightbulb; title: string; desc: string; type: 'danger' | 'warning' | 'success' }> = [];

        if (!isValidContribution && avgPrice > 0) {
            tips.push({
                icon: AlertTriangle,
                title: 'Negatif katkı payı',
                desc: `Satış fiyatı (${formatCurrency(avgPrice)}) değişken maliyetin (${formatCurrency(avgVarCost)}) altında. Fiyat artırın veya maliyet düşürün.`,
                type: 'danger',
            });
        }

        if (isValidContribution && contributionMargin < 20) {
            tips.push({
                icon: Percent,
                title: `Katkı marjı düşük: %${contributionMargin.toFixed(1)}`,
                desc: 'İdeal katkı marjı %30+ olmalıdır. Komisyon veya kargo optimizasyonu düşünün.',
                type: 'warning',
            });
        }

        if (isValidContribution && breakEvenOrders > 0 && dailyBreakEvenOrders > 20) {
            tips.push({
                icon: Package,
                title: `Günlük ${dailyBreakEvenOrders} sipariş zor olabilir`,
                desc: 'Sabit giderleri azaltarak başabaş noktasını düşürmeyi deneyin.',
                type: 'warning',
            });
        }

        if (isValidContribution && targetOrders > 0 && targetOrders <= breakEvenOrders * 1.3) {
            tips.push({
                icon: Lightbulb,
                title: 'Hedefiniz başabaşa çok yakın',
                desc: 'Daha yüksek bir kâr hedefi belirleyerek motivasyonunuzu artırın.',
                type: 'success',
            });
        }

        if (isValidContribution && contributionMargin >= 30 && breakEvenOrders < 100) {
            tips.push({
                icon: Zap,
                title: 'Saglam birim ekonomisi',
                desc: `%${contributionMargin.toFixed(0)} katki marji ile sadece ${breakEvenOrders} sipariste basabasa ulasiyorsunuz.`,
                type: 'success',
            });
        }

        return tips;
    }, [isValidContribution, avgPrice, avgVarCost, contributionMargin, breakEvenOrders, dailyBreakEvenOrders, targetOrders]);

    // ─── Save handler ───────────────────────────────────────────────
    const handleSaveDefaults = async () => {
        if (!user) return;
        setIsSaving(true);
        localStorage.setItem('be_avgPrice', avgPrice.toString());
        localStorage.setItem('be_avgVarCost', avgVarCost.toString());
        const result = await updateProfile({
            fixed_cost_monthly: fixedCost,
            target_profit_monthly: targetProfit,
        });
        if (result.success) {
            toast.success('Veriler kaydedildi.');
            setHasChanges(false);
        } else {
            toast.error('Kaydetme basarisiz: ' + result.error);
        }
        setIsSaving(false);
    };

    // ─── Upgrade gate ───────────────────────────────────────────────
    if (showUpgrade) {
        return (
            <DashboardLayout>
                <div className="flex h-[80vh] items-center justify-center">
                    <UpgradeModal open={true} onClose={() => { }} />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <TooltipProvider delayDuration={200}>
                <div className="space-y-6 pb-24 max-w-7xl mx-auto">

                    {/* ═══ HEADER ═══════════════════════════════════════ */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/5 border border-amber-500/10">
                                <Calculator className="h-5 w-5 text-amber-700 dark:text-amber-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                                    Basabas & Hedef Kar
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Kara gecmek icin gereken satis hedeflerini hesaplayin.
                                </p>
                            </div>
                        </div>
                        {isValidContribution && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-2"
                            >
                                <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10 text-xs gap-1.5 py-1 px-3">
                                    <Banknote className="h-3 w-3" />
                                    Katki Payi: {formatCurrency(contribution)}
                                </Badge>
                                <Badge variant="outline" className={`text-xs gap-1.5 py-1 px-3 ${contributionMargin >= 30
                                    ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                                    : contributionMargin >= 20
                                        ? 'border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10'
                                        : 'border-red-500/30 text-red-400 bg-red-500/10'
                                    }`}>
                                    <Percent className="h-3 w-3" />
                                    Marj: %{contributionMargin.toFixed(1)}
                                </Badge>
                            </motion.div>
                        )}
                    </motion.div>

                    {/* ═══ MAIN GRID ════════════════════════════════════ */}
                    <div className="grid gap-6 lg:grid-cols-12">

                        {/* ─── INPUT PANEL ─────────────────────────────── */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 }}
                            className="lg:col-span-4"
                        >
                            <div className="sticky top-4 space-y-4">
                                <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
                                    <div className="px-5 py-4 border-b border-border/40 bg-muted/5">
                                        <div className="flex items-center gap-2">
                                            <Calculator className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                                            <span className="text-sm font-semibold">Hesaplama Verileri</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">Urun ve isletme giderlerinizi girin.</p>
                                    </div>

                                    <div className="p-5 space-y-5">
                                        {/* Avg Price */}
                                        <div className="space-y-2">
                                            <Label className="text-xs font-medium text-muted-foreground">Ort. Siparis Tutari (KDV Dahil)</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₺</span>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0.00"
                                                    value={avgPrice || ''}
                                                    onChange={(e) => updateLocalPrice(parseFloat(e.target.value) || 0)}
                                                    className="pl-8 tabular-nums h-9 text-sm bg-muted/10 border-border/50"
                                                />
                                            </div>
                                        </div>

                                        {/* Var Cost */}
                                        <div className="space-y-2">
                                            <Label className="text-xs font-medium text-muted-foreground">Ort. Degisken Maliyet (Siparis Basi)</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₺</span>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0.00"
                                                    value={avgVarCost || ''}
                                                    onChange={(e) => updateLocalVarCost(parseFloat(e.target.value) || 0)}
                                                    className="pl-8 tabular-nums h-9 text-sm bg-muted/10 border-border/50"
                                                />
                                            </div>
                                            <p className="text-[10px] text-muted-foreground/70">Urun + kargo + paketleme + komisyon + reklam</p>
                                        </div>

                                        {/* Contribution display */}
                                        {avgPrice > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className={`rounded-lg p-3 border ${isValidContribution
                                                    ? 'bg-emerald-500/[0.06] border-emerald-500/15'
                                                    : 'bg-red-500/[0.06] border-red-500/15'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-muted-foreground">Katki Payi</span>
                                                    <span className={`text-sm font-bold tabular-nums ${isValidContribution ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
                                                        {formatCurrency(contribution)}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-muted/20 rounded-full h-1.5 mt-2">
                                                    <div
                                                        className={`h-1.5 rounded-full transition-all ${isValidContribution ? 'bg-emerald-500' : 'bg-red-500'}`}
                                                        style={{ width: `${Math.min(Math.max(contributionMargin, 0), 100)}%` }}
                                                    />
                                                </div>
                                                <div className="flex justify-between mt-1">
                                                    <span className="text-[10px] text-muted-foreground/50">%0</span>
                                                    <span className="text-[10px] text-muted-foreground/50">%{contributionMargin.toFixed(0)} marj</span>
                                                </div>
                                            </motion.div>
                                        )}

                                        <div className="border-t border-dashed border-border/40" />

                                        {/* Fixed Cost */}
                                        <div className="space-y-2">
                                            <Label className="text-xs font-medium text-amber-700 dark:text-amber-400">Aylik Sabit Giderler</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₺</span>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0.00"
                                                    value={fixedCost || ''}
                                                    onChange={(e) => { setFixedCost(parseFloat(e.target.value) || 0); setHasChanges(true); }}
                                                    className="pl-8 tabular-nums h-9 text-sm bg-amber-500/[0.04] border-amber-500/15 focus-visible:ring-amber-500/30"
                                                />
                                            </div>
                                        </div>

                                        {/* Target Profit */}
                                        <div className="space-y-2">
                                            <Label className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Aylik Hedef Net Kar</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₺</span>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0.00"
                                                    value={targetProfit || ''}
                                                    onChange={(e) => { setTargetProfit(parseFloat(e.target.value) || 0); setHasChanges(true); }}
                                                    className="pl-8 tabular-nums h-9 text-sm bg-emerald-500/[0.04] border-emerald-500/15 focus-visible:ring-emerald-500/30"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Sensitivity Slider */}
                                {isValidContribution && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="rounded-xl border border-border/40 bg-card p-5"
                                    >
                                        <div className="flex items-center gap-2 mb-4">
                                            <BarChart3 className="h-4 w-4 text-blue-400" />
                                            <span className="text-sm font-semibold">Fiyat Hassasiyet Analizi</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-4">
                                            Fiyati {priceAdj >= 0 ? '+' : ''}{priceAdj}% ayarladiginda basabas nasil degisir?
                                        </p>
                                        <Slider
                                            value={[priceAdj]}
                                            onValueChange={(val) => setPriceAdj(val[0])}
                                            min={-30}
                                            max={30}
                                            step={5}
                                            className="mb-3"
                                        />
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>-30%</span>
                                            <span className={priceAdj === 0 ? 'text-foreground font-medium' : ''}>Mevcut</span>
                                            <span>+30%</span>
                                        </div>
                                        {priceAdj !== 0 && (
                                            <div className="mt-3 rounded-lg bg-blue-500/[0.06] border border-blue-500/15 p-2.5 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Yeni fiyat</span>
                                                    <span className="font-medium tabular-nums">{formatCurrency(adjPrice)}</span>
                                                </div>
                                                <div className="flex justify-between mt-1">
                                                    <span className="text-muted-foreground">Yeni basabas</span>
                                                    <span className="font-medium tabular-nums">{breakEvenOrders} siparis</span>
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>

                        {/* ─── RESULTS PANEL ───────────────────────────── */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="lg:col-span-8 space-y-5"
                        >

                            {/* Error banner */}
                            <AnimatePresence>
                                {!isValidContribution && avgPrice > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="rounded-xl border border-red-500/20 bg-gradient-to-r from-red-500/10 to-transparent p-4 flex items-start gap-3"
                                    >
                                        <div className="p-1.5 bg-red-500/15 rounded-lg shrink-0">
                                            <AlertTriangle className="h-4 w-4 text-red-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-red-400">Negatif Katki Payi</h3>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Satış fiyatı değişken maliyeti karşılamıyor. Fiyat artırın veya maliyetleri düşürün.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* KPI Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {/* Break-even Orders */}
                                <div className="group relative overflow-hidden rounded-xl border border-border/40 bg-card p-4 hover:border-border/60 transition-all">
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="relative">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="p-1.5 rounded-lg bg-blue-500/10">
                                                <ShoppingCart className="h-3.5 w-3.5 text-blue-400" />
                                            </div>
                                            <span className="text-[11px] font-medium text-muted-foreground">Basabas Siparis</span>
                                        </div>
                                        <div className="text-2xl font-bold tabular-nums">
                                            {isValidContribution ? breakEvenOrders.toLocaleString('tr-TR') : '-'}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1">adet / ay</p>
                                    </div>
                                </div>

                                {/* Break-even Revenue */}
                                <div className="group relative overflow-hidden rounded-xl border border-border/40 bg-card p-4 hover:border-border/60 transition-all">
                                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="relative">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="p-1.5 rounded-lg bg-violet-500/10">
                                                <Banknote className="h-3.5 w-3.5 text-violet-400" />
                                            </div>
                                            <span className="text-[11px] font-medium text-muted-foreground">Basabas Ciro</span>
                                        </div>
                                        <div className="text-2xl font-bold tabular-nums">
                                            {isValidContribution ? formatCurrency(breakEvenRevenue) : '-'}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1">aylik minimum</p>
                                    </div>
                                </div>

                                {/* Target Orders */}
                                <div className="group relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-4 hover:border-emerald-500/20 transition-all">
                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="relative">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="p-1.5 rounded-lg bg-emerald-500/10">
                                                <Target className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                                            </div>
                                            <span className="text-[11px] font-medium text-muted-foreground">Hedef Siparis</span>
                                        </div>
                                        <div className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                                            {isValidContribution ? targetOrders.toLocaleString('tr-TR') : '-'}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            {formatCurrency(targetProfit)} kar icin
                                        </p>
                                    </div>
                                </div>

                                {/* Target Revenue */}
                                <div className="group relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-4 hover:border-emerald-500/20 transition-all">
                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="relative">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="p-1.5 rounded-lg bg-emerald-500/10">
                                                <TrendingUp className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                                            </div>
                                            <span className="text-[11px] font-medium text-muted-foreground">Hedef Ciro</span>
                                        </div>
                                        <div className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                                            {isValidContribution ? formatCurrency(targetRevenue) : '-'}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1">aylik toplam</p>
                                    </div>
                                </div>
                            </div>

                            {/* Daily Breakdown Bar */}
                            {isValidContribution && breakEvenOrders > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 }}
                                    className="rounded-xl border border-border/40 bg-card p-4"
                                >
                                    <div className="flex items-center gap-2 mb-4">
                                        <Calendar className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                                        <span className="text-sm font-semibold">Gunluk Hedef Kirilimi</span>
                                    </div>

                                    {/* Progress visualization */}
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <div className="flex justify-between text-xs mb-1.5">
                                                <span className="text-muted-foreground">0 siparis</span>
                                                <span className="text-muted-foreground">{dailyTargetOrders > 0 ? `${dailyTargetOrders} siparis (hedef)` : ''}</span>
                                            </div>
                                            <div className="w-full h-3 bg-muted/10 rounded-full overflow-hidden relative">
                                                {/* Break-even zone */}
                                                <div
                                                    className="absolute h-full bg-gradient-to-r from-amber-500/40 to-amber-500/20 rounded-full"
                                                    style={{ width: `${targetOrders > 0 ? (breakEvenOrders / targetOrders) * 100 : 0}%` }}
                                                />
                                                {/* Target zone */}
                                                <div
                                                    className="absolute h-full bg-gradient-to-r from-emerald-500/50 to-emerald-500/30 rounded-full"
                                                    style={{
                                                        left: `${targetOrders > 0 ? (breakEvenOrders / targetOrders) * 100 : 0}%`,
                                                        width: `${targetOrders > 0 ? ((targetOrders - breakEvenOrders) / targetOrders) * 100 : 0}%`,
                                                    }}
                                                />
                                                {/* Break-even marker */}
                                                <div
                                                    className="absolute top-0 bottom-0 w-0.5 bg-amber-400"
                                                    style={{ left: `${targetOrders > 0 ? (breakEvenOrders / targetOrders) * 100 : 0}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between mt-1.5">
                                                <div className="flex items-center gap-3 text-[11px]">
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-2 h-2 rounded-full bg-amber-500/50" />
                                                        <span className="text-muted-foreground">Zarar</span>
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                                                        <span className="text-amber-700 dark:text-amber-400 font-medium">Basabas ({dailyBreakEvenOrders}/gun)</span>
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-2 h-2 rounded-full bg-emerald-500/50" />
                                                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">Kar</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/30">
                                            <div className="text-center">
                                                <div className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-400">{dailyBreakEvenOrders}</div>
                                                <div className="text-[10px] text-muted-foreground">siparis/gun (basabas)</div>
                                            </div>
                                            <div className="text-center border-x border-border/30">
                                                <div className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{dailyTargetOrders}</div>
                                                <div className="text-[10px] text-muted-foreground">siparis/gun (hedef)</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(dailyTargetRevenue)}</div>
                                                <div className="text-[10px] text-muted-foreground">ciro/gun (hedef)</div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Break-even Chart */}
                            {chartData.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="rounded-xl border border-border/40 bg-card overflow-hidden"
                                >
                                    <div className="px-5 py-4 border-b border-border/40">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                                                <span className="text-sm font-semibold">Gelir vs Maliyet Grafigi</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-[11px]">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-3 h-0.5 bg-emerald-500 rounded inline-block" /> Gelir
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-3 h-0.5 bg-red-400 rounded inline-block" /> Maliyet
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Basabas
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-2 py-4 h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.1} />
                                                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                                <XAxis
                                                    dataKey="orders"
                                                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                                    axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                                                    tickLine={false}
                                                    tickFormatter={(v: number) => `${v}`}
                                                />
                                                <YAxis
                                                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                                                    width={50}
                                                />
                                                <RechartsTooltip content={<ChartTooltipContent />} />
                                                <Line
                                                    type="monotone"
                                                    dataKey="revenue"
                                                    stroke="#22c55e"
                                                    strokeWidth={2.5}
                                                    dot={false}
                                                    activeDot={{ r: 4, fill: '#22c55e' }}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="totalCost"
                                                    stroke="#ef4444"
                                                    strokeWidth={2}
                                                    strokeDasharray="6 3"
                                                    dot={false}
                                                    activeDot={{ r: 4, fill: '#ef4444' }}
                                                />
                                                {/* Break-even point */}
                                                <ReferenceDot
                                                    x={breakEvenOrders}
                                                    y={breakEvenRevenue}
                                                    r={6}
                                                    fill="#f59e0b"
                                                    stroke="#f59e0b"
                                                    strokeWidth={2}
                                                    strokeOpacity={0.3}
                                                />
                                                <ReferenceLine
                                                    x={breakEvenOrders}
                                                    stroke="#f59e0b"
                                                    strokeDasharray="4 4"
                                                    strokeOpacity={0.4}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </motion.div>
                            )}

                            {/* Smart Recommendations */}
                            <AnimatePresence>
                                {recommendations.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="grid gap-3 sm:grid-cols-2"
                                    >
                                        {recommendations.map((tip, i) => {
                                            const Icon = tip.icon;
                                            const colorMap = {
                                                danger: { bg: 'from-red-500/8', border: 'border-red-500/15', icon: 'bg-red-500/10 text-red-400' },
                                                warning: { bg: 'from-orange-500/8', border: 'border-orange-500/15', icon: 'bg-orange-500/10 text-orange-400' },
                                                success: { bg: 'from-emerald-500/8', border: 'border-emerald-500/15', icon: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
                                            };
                                            const c = colorMap[tip.type];
                                            return (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    className={`rounded-xl border ${c.border} bg-gradient-to-br ${c.bg} to-transparent p-4`}
                                                >
                                                    <div className="flex gap-3">
                                                        <div className={`p-1.5 rounded-lg ${c.icon} shrink-0 h-fit`}>
                                                            <Icon className="h-3.5 w-3.5" />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-semibold">{tip.title}</h4>
                                                            <p className="text-xs text-muted-foreground mt-0.5">{tip.desc}</p>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Explanation */}
                            <div className="rounded-xl border border-border/40 bg-card p-5 text-sm space-y-3">
                                <div className="flex items-center gap-2 font-semibold text-foreground">
                                    <Info className="h-4 w-4 text-blue-400" />
                                    <span>Bu Veriler Ne Anlama Geliyor?</span>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 text-xs text-muted-foreground">
                                    <div className="space-y-1">
                                        <span className="font-semibold text-foreground block">Basabas Noktasi</span>
                                        Isletmenizin ne kar ne de zarar ettigi noktadir. Bu noktadan sonraki her satis dogrudan kariniza katki saglar.
                                    </div>
                                    <div className="space-y-1">
                                        <span className="font-semibold text-foreground block">Katki Payi ({isValidContribution ? formatCurrency(contribution) : '-'})</span>
                                        Siparis basina elde edilen brut kazanctir. Bu tutar once sabit giderleri karsilar, ardindan net kar olusturur.
                                    </div>
                                </div>
                            </div>

                        </motion.div>
                    </div>
                </div>

                {/* ═══ FLOATING SAVE BAR ═════════════════════════════ */}
                <AnimatePresence>
                    {hasChanges && (
                        <motion.div
                            initial={{ y: 80, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 80, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
                        >
                            <div className="max-w-7xl mx-auto px-4 pb-4 pointer-events-auto">
                                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card px-5 py-3 shadow-md">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                        <span className="text-sm text-muted-foreground">Kaydedilmemis degisiklikler var</span>
                                    </div>
                                    <Button
                                        onClick={handleSaveDefaults}
                                        disabled={isSaving}
                                        size="sm"
                                        className="gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-500/20"
                                    >
                                        <Save className="h-3.5 w-3.5" />
                                        {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </TooltipProvider>
        </DashboardLayout>
    );
}
