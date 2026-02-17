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

export default function CashPlanPage() {
    const { user } = useAuth();

    // State
    const [horizon, setHorizon] = useState<3 | 6 | 12>(6);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rows, setRows] = useState<CashPlanRow[]>([]);
    const [editOpening, setEditOpening] = useState<Record<string, boolean>>({}); // month -> boolean

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

    // Stats
    const lowestCash = Math.min(...rows.map(r => r.closing_cash));
    const negativeMonths = rows.filter(r => r.closing_cash < 0).length;
    const totalNet = rows.reduce((sum, r) => sum + (r.cash_in - r.cash_out), 0);

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
                                {rows.map((row, idx) => {
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

            </div>
        </DashboardLayout>
    );
}
