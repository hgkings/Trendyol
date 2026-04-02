'use client';

import { useMemo, useState } from 'react';
import { Analysis } from '@/types';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { formatCurrency } from '@/components/shared/format';
import { Button } from '@/components/ui/button';
import { Activity } from 'lucide-react';
import { motion } from 'framer-motion';

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
        const grouped: Record<string, number> = {};
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
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-xl border border-border/40 bg-card overflow-hidden"
        >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    <div>
                        <span className="text-sm font-semibold">Kar Trendi</span>
                        <p className="text-[10px] text-muted-foreground">Son {days === 365 ? '1 yil' : `${days} gun`}</p>
                    </div>
                </div>
                <div className="flex gap-1 bg-muted/10 p-1 rounded-lg">
                    {[30, 90, 365].map((d) => (
                        <Button
                            key={d}
                            size="sm"
                            variant="ghost"
                            className={`h-7 px-3 text-xs rounded-md transition-all ${days === d
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                            onClick={() => setDays(d)}
                        >
                            {d === 365 ? '1 Yil' : `${d} Gun`}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="px-2 py-4 h-[280px]">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis
                                dataKey="formattedDate"
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
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload?.length) {
                                        const val = payload[0].value as number;
                                        return (
                                            <div className="rounded-xl border border-border/50 bg-card px-4 py-3 shadow-md">
                                                <p className="text-xs text-muted-foreground mb-1">{payload[0].payload.formattedDate}</p>
                                                <p className={`text-sm font-bold ${val >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
                                                    {formatCurrency(val)}
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
                            <Area
                                type="monotone"
                                dataKey="profit"
                                stroke="#22c55e"
                                strokeWidth={2.5}
                                fill="url(#profitGrad)"
                                dot={{ fill: '#22c55e', r: 3, strokeWidth: 0 }}
                                activeDot={{ r: 5, fill: '#22c55e', stroke: '#22c55e', strokeWidth: 2, strokeOpacity: 0.3 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                        <div className="h-10 w-10 rounded-full bg-muted/20 flex items-center justify-center">
                            <Activity className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                        <p>Bu zaman aralığında veri bulunamadı.</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
