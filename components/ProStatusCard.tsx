'use client';

import { Crown } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { isProUser } from '@/utils/access';

export function ProStatusCard() {
    const { user } = useAuth();

    if (!user) return null;

    const isPro = isProUser(user);

    // Free kullanıcı → hiçbir şey gösterme
    if (!isPro) return null;

    // Bitiş tarihi hesapla
    let expireLabel = '';
    if (user.pro_until) {
        try {
            const d = new Date(user.pro_until);
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                expireLabel = `Bitiş: ${day}.${month}.${year}`;
            }
        } catch { /* null-safe */ }
    }

    return (
        <div className="w-full overflow-hidden rounded-xl border border-emerald-400/30 dark:border-emerald-500/25 bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-950/40 dark:to-green-900/30 p-3 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-3">
                {/* Yeşil daire içinde crown */}
                <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500/20 dark:bg-emerald-500/30 ring-2 ring-emerald-400/30 dark:ring-emerald-500/20">
                    <Crown className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 fill-emerald-600 dark:fill-emerald-400" />
                </div>

                {/* Sağ taraf: yazılar */}
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 truncate whitespace-nowrap leading-tight">
                        PRO AKTİF
                    </span>
                    {expireLabel && (
                        <span className="text-[10px] font-medium text-emerald-600/70 dark:text-emerald-400/60 tracking-wide truncate whitespace-nowrap leading-tight mt-0.5">
                            {expireLabel}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
