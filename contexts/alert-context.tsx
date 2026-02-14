'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './auth-context';
import { Analysis, Notification } from '@/types';
import { generateNotifications } from '@/lib/alerts';
import {
    getStoredAnalyses,
    getNotifications,
    upsertNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead
} from '@/lib/storage';

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
            const analysisData = await getStoredAnalyses(user.id);
            setAnalyses(analysisData);

            // 2. Generate new notifications from analyses and upsert them
            const newNotifications = generateNotifications(analysisData);

            if (newNotifications.length > 0) {
                await upsertNotifications(newNotifications);
            }

            // 3. Fetch all notifications from DB
            const dbNotifications = await getNotifications(user.id);
            setNotifications(dbNotifications);
        } catch (error) {
            console.error('Error fetching alerts:', error);
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
        await markAllNotificationsAsRead(user.id);
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
