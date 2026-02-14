
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
        <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Aylik Kar Trendi</h3>
                <div className="flex gap-1">
                    {[30, 90, 365].map((d) => (
                        <Button
                            key={d}
                            size="sm"
                            variant={days === d ? 'default' : 'ghost'}
                            className="h-7 px-2 text-xs"
                            onClick={() => setDays(d)}
                        >
                            {d === 365 ? '1 Yıl' : `${d} Gūn`}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="h-64 w-full">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis
                                dataKey="formattedDate"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                stroke="#64748B"
                            />
                            <YAxis
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                stroke="#64748B"
                                tickFormatter={(val) => `₺${val / 1000}k`}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                <p className="text-[10px] text-muted-foreground uppercase">{payload[0].payload.date}</p>
                                                <p className="text-sm font-bold text-primary">
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
                                strokeWidth={2}
                                dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                                activeDot={{ r: 5, strokeWidth: 0 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Bu zaman araliginda veri bulunamadi.
                    </div>
                )}
            </div>
        </div>
    );
}
