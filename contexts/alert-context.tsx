'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './auth-context';
import { Analysis, Notification } from '@/types';
import { generateNotifications } from '@/lib/alerts';
import { getStoredAnalyses } from '@/lib/api/analyses';
import {
    getNotifications,
    upsertNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead
} from '@/lib/api/notifications';

interface AlertContextType {
    notifications: Notification[];
    analyses: Analysis[];
    loading: boolean;
    refresh: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [analyses, setAnalyses] = useState<Analysis[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!user) {
            setAnalyses([]);
            setNotifications([]);
            setLoading(false);
            return;
        }

        try {
            // 1. Fetch current analyses
            const analysisData = await getStoredAnalyses();
            setAnalyses(analysisData);

            // 2. Generate local notifications from analyses (client-side only)
            const localNotifications = generateNotifications(analysisData);

            // 3. Fetch DB notifications and merge with local
            let dbNotifications: Notification[] = [];
            try {
                dbNotifications = await getNotifications();
            } catch {
                // silent
            }

            // Merge: DB notifications + local (deduplicate by dedupe_key)
            const existingKeys = new Set(dbNotifications.map(n => n.dedupe_key).filter(Boolean));
            const newLocals = localNotifications.filter(n => !existingKeys.has(n.dedupe_key));
            setNotifications([...dbNotifications, ...newLocals]);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [user]);

    const markAsRead = async (id: string) => {
        await markNotificationAsRead(id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    };

    const markAllAsRead = async () => {
        if (!user) return;
        await markAllNotificationsAsRead();
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    useEffect(() => {
        refresh();
    }, [refresh]);

    return (
        <AlertContext.Provider value={{ notifications, analyses, loading, refresh, markAsRead, markAllAsRead }}>
            {children}
        </AlertContext.Provider>
    );
}

export function useAlerts() {
    const context = useContext(AlertContext);
    if (context === undefined) {
        throw new Error('useAlerts must be used within an AlertProvider');
    }
    return context;
}
