'use client';

import { useState, useMemo } from 'react';
import { Bell, AlertTriangle, ShieldCheck, ChevronRight, Info, CheckCircle2 } from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAlerts } from '@/contexts/alert-context';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { AlertType } from '@/types';
import { useNotificationNavigation } from '@/hooks/use-notification-navigation';

export function NotificationDrawer() {
    const { notifications, loading, markAsRead, markAllAsRead } = useAlerts();
    const router = useRouter();
    const { navigate } = useNotificationNavigation();
    const [filter, setFilter] = useState<AlertType | 'all'>('all');
    const [onlyUnread, setOnlyUnread] = useState(false);
    const [showOnlyCritical, setShowOnlyCritical] = useState(false);

    const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);
    const criticalUnreadCount = useMemo(() => notifications.filter(n => !n.is_read && n.type === 'danger').length, [notifications]);

    const filteredNotifications = useMemo(() => {
        let result = notifications;
        if (showOnlyCritical) {
            result = result.filter(n => n.type === 'danger');
        } else if (filter !== 'all') {
            result = result.filter(n => n.type === filter);
        }

        if (onlyUnread) {
            result = result.filter(n => !n.is_read);
        }

        return result;
    }, [notifications, filter, showOnlyCritical, onlyUnread]);

    const badgeColor = criticalUnreadCount > 0 ? 'bg-red-500' : unreadCount > 0 ? 'bg-yellow-500' : null;

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    {badgeColor && (
                        <span className={cn(
                            "absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-background animate-in zoom-in",
                            badgeColor
                        )}>
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md flex flex-col p-0 gap-0">
                <SheetHeader className="p-6 border-b shrink-0">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="text-xl font-bold">Bildirimler</SheetTitle>
                        {unreadCount > 0 && (
                            <Button variant="ghost" size="sm" className="text-xs h-8 text-primary" onClick={markAllAsRead}>
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                Tümünü okundu yap
                            </Button>
                        )}
                    </div>

                    <div className="mt-4 space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {[
                                { label: 'Tümü', value: 'all' },
                                { label: 'Kritik', value: 'danger' },
                                { label: 'Uyarı', value: 'warning' },
                                { label: 'Bilgi', value: 'info' }
                            ].map((f) => (
                                <button
                                    key={f.value}
                                    onClick={() => {
                                        setFilter(f.value as any);
                                        setShowOnlyCritical(f.value === 'danger');
                                    }}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-medium rounded-full border transition-all",
                                        (filter === f.value)
                                            ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                            : "bg-muted/20 border-border/40 text-muted-foreground hover:bg-muted/50"
                                    )}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-between py-1 px-1">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="unread-toggle"
                                        checked={onlyUnread}
                                        onCheckedChange={setOnlyUnread}
                                    />
                                    <Label htmlFor="unread-toggle" className="text-xs cursor-pointer">Sadece okunmamış</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="critical-toggle"
                                        checked={showOnlyCritical}
                                        onCheckedChange={setShowOnlyCritical}
                                    />
                                    <Label htmlFor="critical-toggle" className="text-xs cursor-pointer">Kritik</Label>
                                </div>
                            </div>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto min-h-0">
                    {filteredNotifications.length > 0 ? (
                        <div className="divide-y">
                            {filteredNotifications.map((n) => (
                                <div
                                    key={n.id}
                                    onClick={() => navigate(n)}
                                    className={cn(
                                        "group relative flex items-start gap-4 p-5 hover:bg-muted/50 transition-colors cursor-pointer",
                                        n.is_read && "opacity-60"
                                    )}
                                >
                                    {!n.is_read && (
                                        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full" />
                                    )}
                                    <div className={cn(
                                        "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
                                        n.type === 'danger' ? "bg-red-500/10 text-red-500 ring-red-500/20" :
                                            n.type === 'warning' ? "bg-yellow-500/10 text-yellow-500 ring-yellow-500/20" :
                                                "bg-blue-500/10 text-blue-500 ring-blue-500/20"
                                    )}>
                                        {n.type === 'danger' ? <AlertTriangle className="h-4 w-4" /> :
                                            n.type === 'warning' ? <Info className="h-4 w-4" /> :
                                                <ShieldCheck className="h-4 w-4" />}
                                    </div>

                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <p className={cn("text-sm font-bold leading-none", n.is_read ? "text-muted-foreground" : "text-foreground")}>
                                                {n.title}
                                            </p>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                                {new Date(n.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground line-clamp-2 pr-4">{n.message}</p>
                                        <div className="pt-2 flex items-center justify-between">
                                            <Badge variant={n.type === 'danger' ? 'destructive' : n.type === 'warning' ? 'warning' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                                {n.type === 'danger' ? 'KRİTİK' : n.type === 'warning' ? 'UYARI' : 'BİLGİ'}
                                            </Badge>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-2" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 p-8 text-center">
                            <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                                <ShieldCheck className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h3 className="font-semibold text-foreground">Bildirim Yok</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {onlyUnread ? "Tüm bildirimleri okudunuz." : "Henüz bir bildirim bulunmuyor."}
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-border/40 bg-muted/10 shrink-0">
                    <Button variant="outline" className="w-full text-xs h-8" onClick={() => router.push('/products')}>
                        Tüm Ürünleri İncele
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
