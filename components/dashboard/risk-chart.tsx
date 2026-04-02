'use client';

import { useMemo } from 'react';
import { Analysis } from '@/types';
import { riskLevelConfig } from '@/utils/risk-engine';
import type { RiskLevel } from '@/types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

interface RiskChartProps {
    analyses: Analysis[];
}

export function RiskChart({ analyses }: RiskChartProps) {
    const chartData = useMemo(() => {
        const counts: Record<RiskLevel, number> = { safe: 0, moderate: 0, risky: 0, dangerous: 0 };
        analyses.forEach((a) => { counts[a.risk.level]++; });

        const levels: RiskLevel[] = ['safe', 'moderate', 'risky', 'dangerous'];
        return levels
            .map(level => ({
                name: riskLevelConfig[level].label,
                value: counts[level],
                color: riskLevelConfig[level].color,
                level,
            }))
            .filter(d => d.value > 0);
    }, [analyses]);

    const total = analyses.length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl border border-border/40 bg-card p-5"
        >
            <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                <span className="text-sm font-semibold">Risk Dagilimi</span>
            </div>

            {chartData.length > 0 ? (
                <div className="flex flex-col items-center">
                    <div className="relative w-[140px] h-[140px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={65}
                                    paddingAngle={3}
                                    dataKey="value"
                                    strokeWidth={0}
                                >
                                    {chartData.map((entry, idx) => (
                                        <Cell key={idx} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold tabular-nums">{total}</span>
                            <span className="text-[10px] text-muted-foreground">ürün</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4">
                        {chartData.map((d) => (
                            <div key={d.level} className="flex items-center gap-1.5 text-[11px]">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                <span className="text-muted-foreground">{d.name}</span>
                                <span className="font-medium">{d.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-[160px] text-muted-foreground text-xs">
                    <ShieldCheck className="h-8 w-8 text-muted-foreground/20 mb-2" />
                    Henüz ürün yok
                </div>
            )}
        </motion.div>
    );
}
