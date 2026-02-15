'use client';

import { useMemo, useState } from 'react';
import { Analysis } from '@/types';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/components/shared/format';
import { Button } from '@/components/ui/button';

interface ProfitTrendChartProps {
    analyses: Analysis[];
}

export function ProfitTrendChart({ analyses }: ProfitTrendChartProps) {
    const [days, setDays] = useState(30);

    const data = useMemo(() => {
        const now = new Date();
        const startDate = new Date();
        startDate.setDate(now.getDate() - days);

        const filtered = analyses.filter((a) => new Date(a.createdAt) >= startDate);

        // Group by date
        const grouped: Record<string, number> = {};

        // Initialize all dates in range with 0 if possible, but for simplicity we'll just sort the existing ones
        filtered.forEach((a) => {
            const date = new Date(a.createdAt).toISOString().split('T')[0];
            grouped[date] = (grouped[date] || 0) + a.result.monthly_net_profit;
        });

        return Object.entries(grouped)
            .map(([date, profit]) => ({
                date,
                profit,
                formattedDate: new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [analyses, days]);

    return (
        <div className="rounded-2xl border bg-card p-6 shadow-premium-sm transition-shadow hover:shadow-premium-md">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold text-foreground">Aylık Kâr Trendi</h3>
                <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
                    {[30, 90, 365].map((d) => (
                        <Button
                            key={d}
                            size="sm"
                            variant="ghost"
                            className={`h-7 px-3 text-xs rounded-lg transition-all ${days === d
                                    ? 'bg-background text-foreground shadow-sm font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                            onClick={() => setDays(d)}
                        >
                            {d === 365 ? '1 Yıl' : `${d} Gün`}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="h-[300px] w-full">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="formattedDate"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                stroke="hsl(var(--muted-foreground))"
                                dy={10}
                            />
                            <YAxis
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                stroke="hsl(var(--muted-foreground))"
                                tickFormatter={(val) => `₺${val / 1000}k`}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="rounded-xl border bg-card p-3 shadow-premium-md">
                                                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1">{payload[0].payload.formattedDate}</p>
                                                <p className="text-lg font-bold text-primary">
                                                    {formatCurrency(payload[0].value as number)}
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="profit"
                                stroke="hsl(var(--primary))"
                                strokeWidth={3}
                                dot={{ fill: 'hsl(var(--background))', stroke: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, strokeWidth: 0, fill: 'hsl(var(--primary))' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-xl">📊</span>
                        </div>
                        <p>Bu zaman aralığında veri bulunamadı.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
