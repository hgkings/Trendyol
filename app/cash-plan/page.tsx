'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/components/shared/format';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
    Loader2, TrendingDown, TrendingUp, Calendar, AlertTriangle,
    Save, Package, Wallet, ShieldAlert, Activity, ArrowDown, ArrowUp,
    Lightbulb, Target, Zap, ChevronDown, BarChart3
} from 'lucide-react';
import { CashPlanRow } from '@/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UpgradeModal } from '@/components/shared/upgrade-modal';
import { isProUser } from '@/utils/access';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

// ─── Helpers ────────────────────────────────────────────────────────
function getNextMonths(count: number): string[] {
    const months = [];
    const today = new Date();
    for (let i = 0; i < count; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        months.push(`${yyyy}-${mm}`);
    }
    return months;
}

function formatMonth(yyyy_mm: string): string {
    const [y, m] = yyyy_mm.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

function formatMonthShort(yyyy_mm: string): string {
    const [y, m] = yyyy_mm.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleDateString('tr-TR', { month: 'short' });
}

function isCurrentMonth(yyyy_mm: string): boolean {
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return yyyy_mm === current;
}

// ─── Scenario multipliers ───────────────────────────────────────────
type Scenario = 'pessimistic' | 'normal' | 'optimistic';
const SCENARIO_CONFIG: Record<Scenario, { label: string; inMul: number; outMul: number; color: string; desc: string }> = {
    pessimistic: { label: 'Kötümser', inMul: 0.75, outMul: 1.2, color: '#ef4444', desc: 'Gelir %25 az, gider %20 fazla' },
    normal: { label: 'Normal', inMul: 1, outMul: 1, color: '#22c55e', desc: 'Girilen veriler aynen kullanılır' },
    optimistic: { label: 'İyimser', inMul: 1.25, outMul: 0.85, color: '#3b82f6', desc: 'Gelir %25 fazla, gider %15 az' },
};

// ─── Custom chart tooltip ───────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-white/10 bg-[#1a1a2e]/95 backdrop-blur-xl px-4 py-3 shadow-2xl">
            <p className="text-xs font-medium text-white/60 mb-2">{label}</p>
            {payload.map((entry, i) => (
                <div key={i} className="flex items-center justify-between gap-6 text-sm">
                    <span className="text-white/70">
                        {entry.dataKey === 'closing' ? 'Kapanış' :
                            entry.dataKey === 'pessimistic' ? 'Kötümser' :
                                entry.dataKey === 'optimistic' ? 'İyimser' : entry.dataKey}
                    </span>
                    <span className={`font-bold tabular-nums ${entry.value < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {formatCurrency(entry.value)}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════
export default function CashPlanPage() {
    const { user } = useAuth();
    const [showUpgrade, setShowUpgrade] = useState(false);
    const tableRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (user && !isProUser(user)) setShowUpgrade(true);
    }, [user]);

    // ─── Core state ─────────────────────────────────────────────────
    const [horizon, setHorizon] = useState<3 | 6 | 12>(6);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rows, setRows] = useState<CashPlanRow[]>([]);
    const [hasChanges, setHasChanges] = useState(false);

    // ─── Stock Simulator ────────────────────────────────────────────
    const [stockCost, setStockCost] = useState<number>(0);
    const [includeStock, setIncludeStock] = useState(false);
    const [stockMonth, setStockMonth] = useState<string>('');

    // ─── Scenario ───────────────────────────────────────────────────
    const [activeScenario, setActiveScenario] = useState<Scenario>('normal');
    const [showScenarioOverlay, setShowScenarioOverlay] = useState(false);

    // ─── Load Data ──────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        const supabase = createClient();
        const { data, error } = await supabase
            .from('cash_plan')
            .select('*')
            .eq('user_id', user.id);

        if (error) {
            toast.error('Veri yüklenemedi.');
            setLoading(false);
            return;
        }

        const months = getNextMonths(horizon);
        const existingMap = new Map<string, CashPlanRow>();
        (data as CashPlanRow[] | null)?.forEach((r) => existingMap.set(r.month, r));

        const newRows: CashPlanRow[] = [];
        for (const m of months) {
            const existing = existingMap.get(m);
            let openCash = 0;
            if (newRows.length > 0) {
                openCash = newRows[newRows.length - 1].closing_cash;
            } else {
                openCash = existing?.opening_cash ?? 0;
            }
            const cashIn = existing?.cash_in ?? 0;
            const cashOut = existing?.cash_out ?? 0;
            const closing = openCash + cashIn - cashOut;
            newRows.push({
                id: existing?.id,
                user_id: user.id,
                month: m,
                opening_cash: openCash,
                cash_in: cashIn,
                cash_out: cashOut,
                closing_cash: closing,
            });
        }

        setRows(newRows);
        if (!stockMonth && newRows.length > 0) setStockMonth(newRows[0].month);
        setLoading(false);
        setHasChanges(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, horizon]);

    useEffect(() => { loadData(); }, [loadData]);

    // ─── Display rows (with stock sim + scenario) ───────────────────
    const displayRows = useMemo(() => {
        const result = rows.map(r => ({ ...r }));

        // Apply scenario multipliers
        if (activeScenario !== 'normal') {
            const cfg = SCENARIO_CONFIG[activeScenario];
            for (const r of result) {
                r.cash_in = Math.round(r.cash_in * cfg.inMul);
                r.cash_out = Math.round(r.cash_out * cfg.outMul);
            }
        }

        // Apply stock simulation
        if (includeStock && stockCost > 0 && stockMonth) {
            const idx = result.findIndex(r => r.month === stockMonth);
            if (idx !== -1) {
                result[idx].cash_out += stockCost;
            }
        }

        // Recalculate chain
        for (let i = 0; i < result.length; i++) {
            if (i > 0) result[i].opening_cash = result[i - 1].closing_cash;
            result[i].closing_cash = result[i].opening_cash + result[i].cash_in - result[i].cash_out;
        }

        return result;
    }, [rows, includeStock, stockCost, stockMonth, activeScenario]);

    // ─── Scenario overlay data for chart ────────────────────────────
    const scenarioData = useMemo(() => {
        if (!showScenarioOverlay) return null;
        const scenarios: Record<string, CashPlanRow[]> = {};
        for (const key of ['pessimistic', 'optimistic'] as Scenario[]) {
            const cfg = SCENARIO_CONFIG[key];
            const result = rows.map(r => ({
                ...r,
                cash_in: Math.round(r.cash_in * cfg.inMul),
                cash_out: Math.round(r.cash_out * cfg.outMul),
            }));
            for (let i = 0; i < result.length; i++) {
                if (i > 0) result[i].opening_cash = result[i - 1].closing_cash;
                result[i].closing_cash = result[i].opening_cash + result[i].cash_in - result[i].cash_out;
            }
            scenarios[key] = result;
        }
        return scenarios;
    }, [rows, showScenarioOverlay]);

    // ─── Chart data ─────────────────────────────────────────────────
    const chartData = useMemo(() => {
        return displayRows.map((row, idx) => {
            const base: Record<string, string | number> = {
                name: formatMonthShort(row.month),
                fullName: formatMonth(row.month),
                closing: row.closing_cash,
                cashIn: row.cash_in,
                cashOut: row.cash_out,
            };
            if (scenarioData) {
                base.pessimistic = scenarioData.pessimistic[idx]?.closing_cash ?? 0;
                base.optimistic = scenarioData.optimistic[idx]?.closing_cash ?? 0;
            }
            return base;
        });
    }, [displayRows, scenarioData]);

    // ─── Stats ──────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const closings = displayRows.map(r => r.closing_cash);
        const lowestCash = Math.min(...closings);
        const lowestIdx = closings.indexOf(lowestCash);
        const lowestMonth = displayRows[lowestIdx]?.month ?? '';
        const negativeMonths = displayRows.filter(r => r.closing_cash < 0).length;
        const totalNet = displayRows.reduce((sum, r) => sum + (r.cash_in - r.cash_out), 0);
        const avgMonthlyNet = displayRows.length > 0 ? totalNet / displayRows.length : 0;

        // Nakit pisti: mevcut nakit ile kaç ay dayanılır
        let runway = 0;
        if (avgMonthlyNet < 0 && displayRows[0]?.opening_cash > 0) {
            runway = Math.floor(displayRows[0].opening_cash / Math.abs(avgMonthlyNet));
        } else if (avgMonthlyNet >= 0) {
            runway = horizon; // Nakit pozitif, tüm dönem güvende
        }

        return { lowestCash, lowestMonth, negativeMonths, totalNet, avgMonthlyNet, runway };
    }, [displayRows, horizon]);

    // ─── Smart recommendations ──────────────────────────────────────
    const recommendations = useMemo(() => {
        const tips: Array<{ icon: typeof Lightbulb; title: string; desc: string; type: 'danger' | 'warning' | 'success' }> = [];

        if (stats.negativeMonths > 0) {
            const deficit = Math.abs(stats.lowestCash);
            const monthlyReduction = Math.ceil(deficit / stats.negativeMonths);
            tips.push({
                icon: ShieldAlert,
                title: `${formatMonth(stats.lowestMonth)}'da ${formatCurrency(deficit)} acik`,
                desc: `Aylik ${formatCurrency(monthlyReduction)} gider azaltarak kapatabilirsiniz.`,
                type: 'danger',
            });
            tips.push({
                icon: Zap,
                title: 'Tahsilat hizinizi artirin',
                desc: 'Pazaryeri hakediş surelerini kisaltacak yontemleri arastirin.',
                type: 'warning',
            });
            tips.push({
                icon: Target,
                title: 'Stok eritme kampanyasi',
                desc: 'Nakit girisi saglamak icin indirimli satis yapmayi dusunun.',
                type: 'warning',
            });
        } else if (stats.totalNet > 0 && displayRows[0]?.opening_cash > 0) {
            tips.push({
                icon: Lightbulb,
                title: 'Nakit fazlaniz var',
                desc: `${formatCurrency(stats.totalNet)} fazla nakit ile stok yatirimi veya reklam butcesi artirabilirsiniz.`,
                type: 'success',
            });
        }

        if (stats.runway > 0 && stats.runway < 3 && stats.avgMonthlyNet < 0) {
            tips.push({
                icon: AlertTriangle,
                title: `Sadece ${stats.runway} ay dayanabiirsiniz`,
                desc: 'Acil olarak gelir artirici veya gider azaltici onlem alin.',
                type: 'danger',
            });
        }

        return tips;
    }, [stats, displayRows]);

    // ─── Input handlers ─────────────────────────────────────────────
    const handleInputChange = (idx: number, field: 'cash_in' | 'cash_out' | 'opening_cash', value: number) => {
        const updated = [...rows];
        updated[idx] = { ...updated[idx], [field]: value };
        for (let i = idx; i < updated.length; i++) {
            if (i > 0) updated[i] = { ...updated[i], opening_cash: updated[i - 1].closing_cash };
            updated[i] = { ...updated[i], closing_cash: updated[i].opening_cash + updated[i].cash_in - updated[i].cash_out };
        }
        setRows(updated);
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        const supabase = createClient();
        const { error } = await supabase.from('cash_plan').upsert(
            rows.map(r => ({
                user_id: user.id,
                month: r.month,
                opening_cash: r.opening_cash,
                cash_in: r.cash_in,
                cash_out: r.cash_out,
                closing_cash: r.closing_cash,
            })),
            { onConflict: 'user_id, month' }
        );
        if (error) {
            toast.error('Kaydetme hatasi: ' + error.message);
        } else {
            toast.success('Nakit plani kaydedildi.');
            setHasChanges(false);
        }
        setSaving(false);
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

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-[50vh]">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
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
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/10">
                                    <Wallet className="h-5 w-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                                        Nakit Plani
                                    </h1>
                                    <p className="text-sm text-muted-foreground">
                                        Nakit akisinizi planlayip riskleri onceden gorun.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Scenario toggle */}
                            <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5">
                                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground hidden sm:inline">Senaryo:</span>
                                {(['pessimistic', 'normal', 'optimistic'] as Scenario[]).map((s) => (
                                    <Tooltip key={s}>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={() => setActiveScenario(s)}
                                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${activeScenario === s
                                                    ? 'bg-white/10 shadow-sm text-foreground'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                                    }`}
                                                style={activeScenario === s ? { boxShadow: `0 0 12px ${SCENARIO_CONFIG[s].color}20` } : {}}
                                            >
                                                {SCENARIO_CONFIG[s].label}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-xs">
                                            {SCENARIO_CONFIG[s].desc}
                                        </TooltipContent>
                                    </Tooltip>
                                ))}
                            </div>

                            {/* Horizon selector */}
                            <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-lg border border-white/[0.06]">
                                {[3, 6, 12].map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => setHorizon(m as 3 | 6 | 12)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${horizon === m
                                            ? 'bg-emerald-500/15 text-emerald-400 shadow-sm shadow-emerald-500/10'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                            }`}
                                    >
                                        {m} Ay
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* ═══ SUMMARY CARDS ═════════════════════════════════ */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
                    >
                        {/* Card: En Düşük Kasa */}
                        <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-4 hover:border-white/[0.1] transition-all">
                            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-1.5 rounded-lg bg-orange-500/10">
                                        <TrendingDown className="h-3.5 w-3.5 text-orange-400" />
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground">En Dusuk Kasa</span>
                                </div>
                                <div className={`text-xl font-bold tabular-nums ${stats.lowestCash < 0 ? 'text-red-400' : 'text-foreground'}`}>
                                    {formatCurrency(stats.lowestCash)}
                                </div>
                                {stats.lowestMonth && (
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        {formatMonth(stats.lowestMonth)}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Card: Açık Veren Aylar */}
                        <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-4 hover:border-white/[0.1] transition-all">
                            <div className={`absolute inset-0 bg-gradient-to-br ${stats.negativeMonths > 0 ? 'from-red-500/8' : 'from-emerald-500/5'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`p-1.5 rounded-lg ${stats.negativeMonths > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                                        <ShieldAlert className={`h-3.5 w-3.5 ${stats.negativeMonths > 0 ? 'text-red-400' : 'text-emerald-400'}`} />
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground">Risk Durumu</span>
                                </div>
                                <div className="text-xl font-bold tabular-nums">
                                    {stats.negativeMonths > 0 ? (
                                        <span className="text-red-400">{stats.negativeMonths} ay riskli</span>
                                    ) : (
                                        <span className="text-emerald-400">Guvende</span>
                                    )}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    {horizon} aylik projeksiyon
                                </p>
                            </div>
                        </div>

                        {/* Card: Nakit Pisti */}
                        <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-4 hover:border-white/[0.1] transition-all">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                                        <Activity className="h-3.5 w-3.5 text-blue-400" />
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground">Nakit Pisti</span>
                                </div>
                                <div className="text-xl font-bold tabular-nums">
                                    {stats.runway >= horizon ? (
                                        <span className="text-emerald-400">{horizon}+ ay</span>
                                    ) : (
                                        <span className={stats.runway < 3 ? 'text-red-400' : 'text-orange-400'}>{stats.runway} ay</span>
                                    )}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    Mevcut nakitle dayanma suresi
                                </p>
                            </div>
                        </div>

                        {/* Card: Ortalama Aylık Net */}
                        <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-4 hover:border-white/[0.1] transition-all">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-1.5 rounded-lg bg-purple-500/10">
                                        <TrendingUp className="h-3.5 w-3.5 text-purple-400" />
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground">Ort. Aylik Net</span>
                                </div>
                                <div className={`text-xl font-bold tabular-nums ${stats.avgMonthlyNet < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {formatCurrency(stats.avgMonthlyNet)}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    Aylik ortalama giris - cikis
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    {/* ═══ AREA CHART ═══════════════════════════════════ */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.02] to-transparent overflow-hidden"
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                            <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-emerald-400" />
                                <span className="text-sm font-semibold">Nakit Akis Grafigi</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <Switch
                                        checked={showScenarioOverlay}
                                        onCheckedChange={setShowScenarioOverlay}
                                        className="scale-75"
                                    />
                                    <span className="text-xs text-muted-foreground">Senaryo karsilastirma</span>
                                </label>
                            </div>
                        </div>
                        <div className="px-2 py-4 h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gradientPositive" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradientPessimistic" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
                                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradientOptimistic" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                        axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                                        width={45}
                                    />
                                    <RechartsTooltip content={<ChartTooltip />} />
                                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />

                                    {showScenarioOverlay && (
                                        <>
                                            <Area
                                                type="monotone"
                                                dataKey="pessimistic"
                                                stroke="#ef4444"
                                                strokeWidth={1.5}
                                                strokeDasharray="4 4"
                                                fill="url(#gradientPessimistic)"
                                                dot={false}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="optimistic"
                                                stroke="#3b82f6"
                                                strokeWidth={1.5}
                                                strokeDasharray="4 4"
                                                fill="url(#gradientOptimistic)"
                                                dot={false}
                                            />
                                        </>
                                    )}

                                    <Area
                                        type="monotone"
                                        dataKey="closing"
                                        stroke="#22c55e"
                                        strokeWidth={2.5}
                                        fill="url(#gradientPositive)"
                                        dot={{ fill: '#22c55e', r: 3, strokeWidth: 0 }}
                                        activeDot={{ r: 5, fill: '#22c55e', stroke: '#22c55e', strokeWidth: 2, strokeOpacity: 0.3 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        {showScenarioOverlay && (
                            <div className="flex items-center justify-center gap-6 pb-3 text-[11px]">
                                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-400 rounded inline-block" style={{ borderTop: '2px dashed #ef4444' }} /> Kotumser</span>
                                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 rounded inline-block" /> Normal</span>
                                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-400 rounded inline-block" style={{ borderTop: '2px dashed #3b82f6' }} /> Iyimser</span>
                            </div>
                        )}
                    </motion.div>

                    {/* ═══ STOCK SIMULATOR ═══════════════════════════════ */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                    >
                        <Card className="border-white/[0.06] bg-gradient-to-r from-blue-500/[0.03] to-transparent overflow-hidden">
                            <CardContent className="pt-5 pb-4">
                                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/10">
                                            <Package className="h-4 w-4 text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-sm">Stok Alim Simulasyonu</h3>
                                            <p className="text-xs text-muted-foreground">Stok alirsaniz nakit akisiniz nasil etkilenir?</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                                        <div className="grid gap-1 flex-1 sm:flex-none">
                                            <Label htmlFor="stock-month" className="text-[11px] text-muted-foreground">Alim Ayi</Label>
                                            <Select value={stockMonth} onValueChange={setStockMonth}>
                                                <SelectTrigger className="h-8 w-full sm:w-[150px] text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {rows.map(r => (
                                                        <SelectItem key={r.month} value={r.month} className="text-xs">
                                                            {formatMonth(r.month)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-1 flex-1 sm:flex-none">
                                            <Label htmlFor="stock-cost" className="text-[11px] text-muted-foreground">Tutar (TL)</Label>
                                            <Input
                                                id="stock-cost"
                                                type="number"
                                                placeholder="0"
                                                value={stockCost || ''}
                                                onChange={(e) => setStockCost(parseFloat(e.target.value) || 0)}
                                                className="h-8 w-full sm:w-[120px] text-xs"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 pt-4">
                                            <Switch
                                                id="include-stock"
                                                checked={includeStock}
                                                onCheckedChange={setIncludeStock}
                                            />
                                            <Label htmlFor="include-stock" className="text-xs cursor-pointer">
                                                Aktif
                                            </Label>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* ═══ SMART RECOMMENDATIONS ═════════════════════════ */}
                    <AnimatePresence>
                        {recommendations.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                            >
                                {recommendations.map((tip, i) => {
                                    const Icon = tip.icon;
                                    const colorMap = {
                                        danger: { bg: 'from-red-500/8', border: 'border-red-500/15', icon: 'bg-red-500/10 text-red-400' },
                                        warning: { bg: 'from-orange-500/8', border: 'border-orange-500/15', icon: 'bg-orange-500/10 text-orange-400' },
                                        success: { bg: 'from-emerald-500/8', border: 'border-emerald-500/15', icon: 'bg-emerald-500/10 text-emerald-400' },
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

                    {/* ═══ TABLE ═════════════════════════════════════════ */}
                    <motion.div
                        ref={tableRef}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.02] to-transparent overflow-hidden"
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-[#0f1117]/95 backdrop-blur-sm border-b border-white/[0.06]">
                                        <th className="py-3 px-4 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider min-w-[150px]">Ay</th>
                                        <th className="py-3 px-4 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider min-w-[140px]">Baslangic</th>
                                        <th className="py-3 px-4 text-right font-semibold text-xs uppercase tracking-wider min-w-[140px]">
                                            <span className="text-emerald-400 flex items-center justify-end gap-1">
                                                <ArrowDown className="h-3 w-3" /> Giris
                                            </span>
                                        </th>
                                        <th className="py-3 px-4 text-right font-semibold text-xs uppercase tracking-wider min-w-[140px]">
                                            <span className="text-red-400 flex items-center justify-end gap-1">
                                                <ArrowUp className="h-3 w-3" /> Cikis
                                            </span>
                                        </th>
                                        <th className="py-3 px-4 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider min-w-[120px]">Net</th>
                                        <th className="py-3 px-4 text-right font-semibold text-xs uppercase tracking-wider min-w-[150px]">Kapanis</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayRows.map((row, idx) => {
                                        const isFirst = idx === 0;
                                        const isCurrent = isCurrentMonth(row.month);
                                        const isNegative = row.closing_cash < 0;
                                        const netChange = row.cash_in - row.cash_out;
                                        const prevClosing = idx > 0 ? displayRows[idx - 1].closing_cash : null;
                                        const changePercent = prevClosing && prevClosing !== 0
                                            ? ((row.closing_cash - prevClosing) / Math.abs(prevClosing)) * 100
                                            : null;

                                        return (
                                            <tr
                                                key={row.month}
                                                className={`group transition-colors border-b border-white/[0.03] ${isNegative
                                                    ? 'bg-red-500/[0.04] hover:bg-red-500/[0.07] border-l-2 border-l-red-500/40'
                                                    : 'hover:bg-white/[0.02]'
                                                    } ${isCurrent ? 'bg-emerald-500/[0.03]' : ''}`}
                                            >
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className={`h-3.5 w-3.5 ${isCurrent ? 'text-emerald-400' : 'text-muted-foreground/40'}`} />
                                                        <span className={`font-medium text-sm ${isCurrent ? 'text-foreground' : ''}`}>
                                                            {formatMonth(row.month)}
                                                        </span>
                                                        {isCurrent && (
                                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                                                                Bu Ay
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {isFirst ? (
                                                        <Input
                                                            type="number"
                                                            value={rows[idx].opening_cash}
                                                            onChange={(e) => handleInputChange(idx, 'opening_cash', parseFloat(e.target.value) || 0)}
                                                            className="h-8 text-right pr-2 tabular-nums bg-white/[0.03] border-white/10 max-w-[130px] ml-auto block text-sm"
                                                        />
                                                    ) : (
                                                        <span className="tabular-nums text-muted-foreground block text-right text-sm">
                                                            {formatCurrency(row.opening_cash)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Input
                                                        type="number"
                                                        value={rows[idx].cash_in}
                                                        onChange={(e) => handleInputChange(idx, 'cash_in', parseFloat(e.target.value) || 0)}
                                                        className="h-8 text-right tabular-nums text-emerald-400 font-medium max-w-[130px] ml-auto block bg-emerald-500/[0.06] border-emerald-500/15 focus-visible:ring-emerald-500/30 text-sm"
                                                    />
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Input
                                                        type="number"
                                                        value={rows[idx].cash_out}
                                                        onChange={(e) => handleInputChange(idx, 'cash_out', parseFloat(e.target.value) || 0)}
                                                        className="h-8 text-right tabular-nums text-red-400 font-medium max-w-[130px] ml-auto block bg-red-500/[0.06] border-red-500/15 focus-visible:ring-red-500/30 text-sm"
                                                    />
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className={`text-right tabular-nums text-sm ${netChange >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                                                        {netChange >= 0 ? '+' : ''}{formatCurrency(netChange)}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className={`tabular-nums font-bold text-sm py-1.5 px-3 rounded-lg text-right inline-flex items-center gap-2 float-right ${isNegative
                                                                ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                                                                : 'bg-white/[0.04] border border-white/[0.06]'
                                                                }`}>
                                                                {formatCurrency(row.closing_cash)}
                                                                {changePercent !== null && (
                                                                    <span className={`text-[10px] font-normal ${changePercent >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
                                                                        {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(0)}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TooltipTrigger>
                                                        {changePercent !== null && (
                                                            <TooltipContent side="left" className="text-xs">
                                                                Gecen aya gore %{Math.abs(changePercent).toFixed(1)} {changePercent >= 0 ? 'artis' : 'azalis'}
                                                            </TooltipContent>
                                                        )}
                                                    </Tooltip>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
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
                                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0f1117]/90 backdrop-blur-xl px-5 py-3 shadow-2xl shadow-black/40">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                        <span className="text-sm text-muted-foreground">Kaydedilmemis degisiklikler var</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => { loadData(); }}
                                            className="text-xs"
                                        >
                                            Vazgec
                                        </Button>
                                        <Button
                                            onClick={handleSave}
                                            disabled={saving}
                                            size="sm"
                                            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                                        >
                                            <Save className="h-3.5 w-3.5" />
                                            {saving ? 'Kaydediliyor...' : 'Degisiklikleri Kaydet'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </TooltipProvider>
        </DashboardLayout>
    );
}
