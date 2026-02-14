'use client';

import { useRouter } from 'next/navigation';
import { Notification } from '@/types';
import { toast } from 'sonner';
import { useAlerts } from '@/contexts/alert-context';

export function useNotificationNavigation() {
    const router = useRouter();
    const { markAsRead } = useAlerts();

    const navigate = async (notification: Notification) => {
        // Development logging
        if (process.env.NODE_ENV === 'development') {
            console.debug("notification click", notification);
        }

        try {
            // Mark as read immediately when clicked
            if (!notification.is_read) {
                await markAsRead(notification.id);
            }

            // Determine target href
            let targetHref = notification.href;

            if (!targetHref) {
                if (notification.analysis_id) {
                    targetHref = `/analysis/${notification.analysis_id}`;
                } else if (notification.product_id) {
                    targetHref = `/products/${notification.product_id}`;
                }
            }

            // Fallback navigation for bulk/csv if category matches
            if (!targetHref && notification.category === 'bulk') {
                targetHref = '/products';
            }

            if (targetHref) {
                router.push(targetHref);
            } else {
                console.warn("Notification click: No valid target route found", notification);
                toast.error('Kayıt bulunamadı', {
                    description: 'İlgili analiz veya ürün detayına ulaşılamıyor.',
                });
            }
        } catch (error) {
            console.error('Notification navigation error:', error);
            toast.error('Gezinme hatası oluştu.');
        }
    };

    return { navigate };
}
