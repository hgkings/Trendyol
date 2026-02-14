'use client';

import { useAlerts } from '@/contexts/alert-context';
import { AlertTriangle, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export function CriticalBanner() {
    const { notifications, markAsRead } = useAlerts();
    const [closed, setClosed] = useState(false);

    // Find the most recent unread danger notification
    const criticalAlert = useMemo(() => {
        return notifications.find(n => !n.is_read && n.type === 'danger');
    }, [notifications]);

    if (!criticalAlert || closed) return null;

    return (
        <div className="relative isolate flex items-center gap-x-6 overflow-hidden bg-red-600 px-6 py-2.5 sm:px-3.5 sm:before:flex-1 animate-in slide-in-from-top duration-500">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="text-sm leading-6 text-white flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 animate-pulse" />
                    <strong className="font-bold">KRİTİK: {criticalAlert.title}</strong>
                    <svg viewBox="0 0 2 2" className="mx-auto inline h-0.5 w-0.5 fill-current" aria-hidden="true">
                        <circle cx="1" cy="1" r="1" />
                    </svg>
                    {criticalAlert.message}
                </p>
                <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 rounded-full px-3 text-xs font-semibold shadow-sm hover:bg-white/90"
                    onClick={() => {
                        // This will open the drawer in a real app if we had a state for it,
                        // but for now let's just mark it as read which will also hide the banner.
                        markAsRead(criticalAlert.id);
                    }}
                >
                    Görüntüle <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
            </div>
            <div className="flex flex-1 justify-end">
                <button
                    type="button"
                    className="-m-3 p-3 focus-visible:outline-offset-[-4px]"
                    onClick={() => {
                        // Marking as read so it doesn't reappear until a new one comes
                        markAsRead(criticalAlert.id);
                    }}
                >
                    <span className="sr-only">Kapat</span>
                    <X className="h-5 w-5 text-white" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}
