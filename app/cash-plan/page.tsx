'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/components/shared/format';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, TrendingDown, TrendingUp, Calendar, AlertTriangle, Save, Lock, Unlock } from 'lucide-react';
import { CashPlanRow } from '@/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Package } from 'lucide-react';

// Helper to get next N months YYYY-MM
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

import { UpgradeModal } from '@/components/shared/upgrade-modal';
// ... existing imports

export default function CashPlanPage() {
    const { user } = useAuth();
    const [showUpgrade, setShowUpgrade] = useState(false);

    useEffect(() => {
        if (user && user.plan !== 'pro' && user.plan !== 'admin') {
            setShowUpgrade(true);
        }
    }, [user]);



    // State
    const [horizon, setHorizon] = useState<3 | 6 | 12>(6);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rows, setRows] = useState<CashPlanRow[]>([]);
    const [editOpening, setEditOpening] = useState<Record<string, boolean>>({}); // month -> boolean

    // Stock Simulator State
    const [stockCost, setStockCost] = useState<number>(0);
    const [includeStock, setIncludeStock] = useState<boolean>(false);

    // Initialize
    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        // Fetch existing plan
        const { data, error } = await supabase
            .from('cash_plan')
            .select('*')
            .eq('user_id', user.id);

        if (error) {
            toast.error('Veri yüklenemedi.');
            setLoading(false);
            return;
        }

        // Generate months based on horizon
        const months = getNextMonths(horizon);
        const existingMap = new Map<string, CashPlanRow>();
        data?.forEach((r) => existingMap.set(r.month, r));

        // Merge logic
        let currentOpening = 0;
        // Ideally user sets opening cash for first month, then it propagates.
        // If Month 1 exists in DB, use its opening. If not, 0.

        const newRows: CashPlanRow[] = [];

        for (const m of months) {
            const existing = existingMap.get(m);

            // Determine opening cash
            let openCash = 0;
            if (newRows.length > 0) {
                // Previous month's closing
                openCash = newRows[newRows.length - 1].closing_cash;
            } else {
                // First month: use DB value if exists (user input previously), or 0
                openCash = existing?.opening_cash ?? 0;
            }

            // If user manually edited opening cash for this specific month in DB, respect it? 
            // For simplicity in this logic: 
            // - First month opening is fully editable and saved.
            // - Subsequent months opening = Prev Closing (calculated).
            // - We calculate Closing = Opening + In - Out on the fly here.

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
        setLoading(false);
    }, [user, horizon]);

    // Derived Rows with Stock Simulation
    const simulatedRows = rows.map((row, idx) => {
        if (!includeStock || stockCost <= 0) return row;

        // Apply stock cost to the FIRST month only (as per plan "Bu ay")
        const isFirstMonth = idx === 0;
        const adjustedCashOut = isFirstMonth ? row.cash_out + stockCost : row.cash_out;

        // We need to recalculate the chain because closing balance affects next opening
        return {
            ...row,
            cash_out: adjustedCashOut,
            // closing_cash will be recalculated in the next loop effectively
            // BUT simpler: let's recalculate the whole chain based on the base 'rows' state
        };
    });

    // Re-calculate the chain for display
    const displayRows = [...rows];
    if (includeStock && stockCost > 0 && displayRows.length > 0) {
        // Apply to first month
        displayRows[0] = { ...displayRows[0], cash_out: displayRows[0].cash_out + stockCost };

        // Recalculate all closings
        for (let i = 0; i < displayRows.length; i++) {
            if (i > 0) {
                displayRows[i] = { ...displayRows[i], opening_cash: displayRows[i - 1].closing_cash };
            }
            displayRows[i] = { ...displayRows[i], closing_cash: displayRows[i].opening_cash + displayRows[i].cash_in - displayRows[i].cash_out };
        }
    }

    useEffect(() => {
        loadData();
    }, [loadData]);


    // Handlers
    const handleInputChange = (idx: number, field: 'cash_in' | 'cash_out' | 'opening_cash', value: number) => {
        const updated = [...rows];
        updated[idx][field] = value;

        // Recalculate chain
        for (let i = idx; i < updated.length; i++) {
            const row = updated[i];

            // If not first row, update opening from prev closing
            if (i > 0) {
                row.opening_cash = updated[i - 1].closing_cash;
            }

            row.closing_cash = row.opening_cash + row.cash_in - row.cash_out;
        }

        setRows(updated);
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);

        // Upsert all rows
        const { error } = await supabase.from('cash_plan').upsert(
            rows.map(r => ({
                user_id: user.id,
                month: r.month,
                opening_cash: r.opening_cash,
                cash_in: r.cash_in,
                cash_out: r.cash_out,
                closing_cash: r.closing_cash
            })),
            { onConflict: 'user_id, month' }
        );

        if (error) {
            toast.error('Kaydetme hatası: ' + error.message);
        } else {
            toast.success('Nakit planı kaydedildi.');
        }
        setSaving(false);
    };

    // Stats (Use displayRows for UI)
    const lowestCash = Math.min(...displayRows.map(r => r.closing_cash));
    const negativeMonths = displayRows.filter(r => r.closing_cash < 0).length;
    const totalNet = displayRows.reduce((sum, r) => sum + (r.cash_in - r.cash_out), 0);

    if (showUpgrade) {
        return (
            <DashboardLayout>
                <div className="flex h-[80vh] items-center justify-center">
                    <UpgradeModal
                        open={true}
                        onClose={() => { }}
                    />
                </div>
            </DashboardLayout>
        );
    }

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-[50vh]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-8 pb-12 max-w-6xl mx-auto">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Nakit Planı</h1>
                        <p className="text-muted-foreground mt-1">
                            Gelecek aylar için nakit akışınızı planlayın ve riskleri görün.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border">
                        {[3, 6, 12].map((m) => (
                            <button
                                key={m}
                                onClick={() => setHorizon(m as any)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${horizon === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-background/50'
                                    }`}
                            >
                                {m} Ay
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stock Simulator */}
            <Card className="border-dashed border-2 bg-muted/20">
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base">Stok Alım Simülasyonu</h3>
                                <p className="text-xs text-muted-foreground">Bu ay stok alırsanız nakit akışınız nasıl etkilenir?</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <div className="grid gap-1.5 flex-1 sm:flex-none">
                                <Label htmlFor="stock-cost" className="text-xs">Ek Stok Maliyeti (₺)</Label>
                                <Input
                                    id="stock-cost"
                                    type="number"
                                    placeholder="0"
                                    value={stockCost || ''}
                                    onChange={(e) => setStockCost(parseFloat(e.target.value) || 0)}
                                    className="h-9 w-full sm:w-[140px]"
                                />
                            </div>
                            <div className="flex items-center space-x-2 pt-4">
                                <Switch
                                    id="include-stock"
                                    checked={includeStock}
                                    onCheckedChange={setIncludeStock}
                                />
                                <Label htmlFor="include-stock" className="text-sm font-medium cursor-pointer">
                                    Plana Dahil Et
                                </Label>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Risk Warning Banner */}
            {negativeMonths > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
                    <div className="flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-red-900 dark:text-red-300">Nakit Akışı Riski Tespit Edildi</h3>
                            <p className="text-sm text-red-800 dark:text-red-200 mt-1">
                                Önümüzdeki {horizon} ay içinde toplam <strong>{negativeMonths} ayda</strong> nakit açığı (negatif bakiye) öngörülüyor.
                            </p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="text-xs bg-white/50 dark:bg-black/20 p-2 rounded border border-red-100 dark:border-red-900/30">
                                    <span className="font-medium block mb-0.5">📉 Stok Yönetimi:</span>
                                    Fazla stok maliyetini azaltın veya vadeli alımları artırın.
                                </div>
                                <div className="text-xs bg-white/50 dark:bg-black/20 p-2 rounded border border-red-100 dark:border-red-900/30">
                                    <span className="font-medium block mb-0.5">💰 Tahsilat Hızı:</span>
                                    Pazaryeri hakediş sürelerini kısaltacak yöntemleri araştırın.
                                </div>
                                <div className="text-xs bg-white/50 dark:bg-black/20 p-2 rounded border border-red-100 dark:border-red-900/30">
                                    <span className="font-medium block mb-0.5">🚀 Satış Artırma:</span>
                                    Nakit girişi sağlamak için stok eritme kampanyası yapın.
                                </div>
                                <div className="text-xs bg-white/50 dark:bg-black/20 p-2 rounded border border-red-100 dark:border-red-900/30">
                                    <span className="font-medium block mb-0.5">🛑 Gider Kısıtlaması:</span>
                                    Reklam ve operasyonel giderleri gözden geçirin.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="shadow-sm border-l-4 border-l-primary">
                    <CardContent className="pt-6 pb-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <TrendingDown className="h-4 w-4" />
                            En Düşük Kasa
                        </div>
                        <div className={`text-2xl font-bold tabular-nums ${lowestCash < 0 ? 'text-red-600' : 'text-foreground'}`}>
                            {formatCurrency(lowestCash)}
                        </div>
                    </CardContent>
                </Card>

                <Card className={`shadow-sm border-l-4 ${negativeMonths > 0 ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20' : 'border-l-emerald-500'}`}>
                    <CardContent className="pt-6 pb-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <AlertTriangle className="h-4 w-4" />
                            Açık Veren Ay Sayısı
                        </div>
                        <div className="text-2xl font-bold tabular-nums">
                            {negativeMonths} <span className="text-sm font-normal text-muted-foreground">ay riskli</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-l-4 border-l-blue-500">
                    <CardContent className="pt-6 pb-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <TrendingUp className="h-4 w-4" />
                            Toplam Net Nakit
                        </div>
                        <div className="text-2xl font-bold tabular-nums">
                            {formatCurrency(totalNet)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50 border-b">
                                <th className="py-3 px-4 text-left font-semibold text-muted-foreground min-w-[140px]">Ay</th>
                                <th className="py-3 px-4 text-left font-semibold text-muted-foreground min-w-[140px]">Başlangıç Nakit</th>
                                <th className="py-3 px-4 text-left font-semibold text-emerald-600 dark:text-emerald-500 min-w-[140px]">Nakit Girişi (+)</th>
                                <th className="py-3 px-4 text-left font-semibold text-red-600 dark:text-red-400 min-w-[140px]">Nakit Çıkışı (-)</th>
                                <th className="py-3 px-4 text-left font-semibold text-muted-foreground min-w-[120px]">Net Değişim</th>
                                <th className="py-3 px-4 text-left font-semibold text-foreground min-w-[140px]">Kapanış Nakit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {displayRows.map((row, idx) => {
                                const isFirst = idx === 0;
                                const isNegative = row.closing_cash < 0;

                                return (
                                    <tr key={row.month} className="group hover:bg-muted/30 transition-colors">
                                        <td className="py-3 px-4 font-medium flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground opacity-50" />
                                            {formatMonth(row.month)}
                                        </td>
                                        <td className="py-3 px-4">
                                            {isFirst ? (
                                                <div className="relative max-w-[120px]">
                                                    <Input
                                                        type="number"
                                                        value={row.opening_cash}
                                                        onChange={(e) => handleInputChange(idx, 'opening_cash', parseFloat(e.target.value) || 0)}
                                                        className="h-8 text-right pr-2 tabular-nums bg-background"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="tabular-nums text-muted-foreground block text-right pr-2 max-w-[120px]">
                                                    {formatCurrency(row.opening_cash)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <Input
                                                type="number"
                                                value={row.cash_in}
                                                onChange={(e) => handleInputChange(idx, 'cash_in', parseFloat(e.target.value) || 0)}
                                                className="h-8 text-right tabular-nums text-emerald-600 font-medium max-w-[120px] bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 focus-visible:ring-emerald-500"
                                            />
                                        </td>
                                        <td className="py-3 px-4">
                                            <Input
                                                type="number"
                                                value={row.cash_out}
                                                onChange={(e) => handleInputChange(idx, 'cash_out', parseFloat(e.target.value) || 0)}
                                                className="h-8 text-right tabular-nums text-red-600 font-medium max-w-[120px] bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 focus-visible:ring-red-500"
                                            />
                                        </td>
                                        <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                                            {formatCurrency(row.cash_in - row.cash_out)}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className={`tabular-nums font-bold py-1 px-2 rounded-md inline-block ${isNegative ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' : 'bg-muted/50'
                                                }`}>
                                                {formatCurrency(row.closing_cash)}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer Action */}
                <div className="p-4 bg-muted/20 border-t flex justify-end">
                    <Button onClick={handleSave} disabled={saving} className="gap-2">
                        <Save className="h-4 w-4" />
                        {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                    </Button>
                </div>
            </div>

        </DashboardLayout >
    );
}
