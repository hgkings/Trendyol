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
  const accentClass = trend === 'up' ? 'bg-emerald-500' : trend === 'down' ? 'bg-red-500' : 'bg-border';

  return (
    <div className={cn(
      'flex overflow-hidden rounded-2xl border border-border/30 bg-card hover:border-border/60 transition-colors duration-200',
      className
    )}>
      <div className={cn('w-[3px] shrink-0', accentClass)} />
      <div className="flex flex-1 items-start justify-between p-6">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tracking-tight mt-1">{value}</p>
          {subtitle && (
            <p className={cn(
              'text-xs font-medium',
              trend === 'up' && 'text-emerald-700 dark:text-emerald-400',
              trend === 'down' && 'text-red-400',
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
