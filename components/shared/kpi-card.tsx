'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function KPICard({ title, value, subtitle, icon: Icon, trend, className }: KPICardProps) {
  return (
    <div className={cn(
      'rounded-2xl border bg-card p-6 shadow-premium-sm transition-all duration-200 hover:shadow-premium-md',
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className={cn(
              'text-xs font-medium',
              trend === 'up' && 'text-emerald-600 dark:text-emerald-400',
              trend === 'down' && 'text-red-600 dark:text-red-400',
              trend === 'neutral' && 'text-muted-foreground',
              !trend && 'text-muted-foreground'
            )}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="rounded-xl bg-primary/8 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  );
}
