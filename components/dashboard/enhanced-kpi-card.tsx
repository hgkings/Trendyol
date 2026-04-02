'use client';

import { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface EnhancedKPICardProps {
    title: string;
    value: string;
    subtitle?: string;
    icon: LucideIcon;
    color: 'emerald' | 'red' | 'amber' | 'blue' | 'violet' | 'purple';
    href?: string;
    delay?: number;
}

const COLOR_MAP: Record<string, { iconBg: string; iconText: string; hoverGrad: string }> = {
    emerald: { iconBg: 'bg-emerald-500/10', iconText: 'text-emerald-700 dark:text-emerald-400', hoverGrad: 'from-emerald-500/5' },
    red: { iconBg: 'bg-red-500/10', iconText: 'text-red-400', hoverGrad: 'from-red-500/5' },
    amber: { iconBg: 'bg-amber-500/10', iconText: 'text-amber-700 dark:text-amber-400', hoverGrad: 'from-amber-500/5' },
    blue: { iconBg: 'bg-blue-500/10', iconText: 'text-blue-400', hoverGrad: 'from-blue-500/5' },
    violet: { iconBg: 'bg-violet-500/10', iconText: 'text-violet-400', hoverGrad: 'from-violet-500/5' },
    purple: { iconBg: 'bg-purple-500/10', iconText: 'text-purple-400', hoverGrad: 'from-purple-500/5' },
};

export function EnhancedKPICard({ title, value, subtitle, icon: Icon, color, href, delay = 0 }: EnhancedKPICardProps) {
    const c = COLOR_MAP[color] || COLOR_MAP.emerald;

    const card = (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className={`group relative overflow-hidden rounded-xl border border-border/40 bg-card p-4 hover:border-border/60 transition-all ${href ? 'cursor-pointer' : ''}`}
        >
            <div className={`absolute inset-0 bg-gradient-to-br ${c.hoverGrad} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                    <div className={`p-1.5 rounded-lg ${c.iconBg}`}>
                        <Icon className={`h-3.5 w-3.5 ${c.iconText}`} />
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">{title}</span>
                </div>
                <div className="text-xl font-bold tabular-nums truncate">{value}</div>
                {subtitle && (
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">{subtitle}</p>
                )}
            </div>
        </motion.div>
    );

    if (href) {
        return <Link href={href}>{card}</Link>;
    }
    return card;
}
