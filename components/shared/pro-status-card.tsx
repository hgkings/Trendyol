import React from 'react';
import { Crown, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { isProUser } from '@/utils/access';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export function ProStatusCard({ className }: { className?: string }) {
    const { user } = useAuth();

    // Safety check
    if (!user) return null;

    const isPro = isProUser(user);

    // Render Free Plan Badge
    if (!isPro) {
        return (
            <div className={cn("w-full px-3", className)}>
                <Link href="/pricing" className="block w-full">
                    <div className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors group cursor-pointer">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors overflow-hidden whitespace-nowrap text-ellipsis">
                            Ücretsiz Plan
                        </span>
                        <div className="bg-primary/10 text-primary p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                            <Sparkles className="w-3.5 h-3.5" />
                        </div>
                    </div>
                </Link>
            </div>
        );
    }

    // Determine Pro Expiration Date UI
    let expireText = '';
    if (user.pro_until) {
        try {
            const d = new Date(user.pro_until);
            if (!isNaN(d.getTime())) {
                expireText = `Bitiş: ${format(d, 'dd.MM.yyyy', { locale: tr })}`;
            }
        } catch { }
    }

    // Render Premium Pro Card
    return (
        <div className={cn("w-full px-3", className)}>
            <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-3 shadow-sm group hover:border-emerald-500/30 hover:shadow-md transition-all cursor-default">

                {/* Glow Effect */}
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-emerald-500/10 blur-[30px] rounded-full group-hover:bg-emerald-500/20 transition-colors pointer-events-none" />

                <div className="relative z-10 flex flex-col gap-1">
                    {/* Header Row */}
                    <div className="flex items-center gap-2">
                        <div className="bg-emerald-500/20 p-1.5 rounded-md text-emerald-600 dark:text-emerald-400">
                            <Crown className="w-4 h-4 fill-current drop-shadow-sm" />
                        </div>
                        <span className="text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 truncate shadow-none leading-none pt-0.5">
                            PRO AKTİF
                        </span>
                    </div>

                    {/* Expiration Details */}
                    {expireText && (
                        <div className="pl-0.5 mt-0.5">
                            <span className="text-[10px] font-medium text-emerald-600/70 dark:text-emerald-400/70 tracking-wide block truncate">
                                {expireText}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
