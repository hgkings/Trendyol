
import { Analysis, Notification, AlertType } from '@/types';

export function generateNotifications(analyses: Analysis[]): Partial<Notification>[] {
    const notifications: Partial<Notification>[] = [];

    analyses.forEach((analysis) => {
        const { input, result, risk, id, userId } = analysis;

        let type: AlertType = 'info';
        let category = 'safe';
        let title = input.product_name;
        let message = 'Ürün karlılığı ve risk seviyesi normal.';

        if (risk.level === 'dangerous' || result.monthly_net_profit < 0) {
            type = 'danger';
            category = 'critical';
            message = result.monthly_net_profit < 0
                ? 'Aylık zarar ediyorsunuz.'
                : 'Risk seviyesi kritik.';
        } else if (risk.level === 'risky' || risk.level === 'moderate' || result.margin_pct < 15 || input.return_rate_pct > 12) {
            type = 'warning';
            category = 'warning';
            if (result.margin_pct < 15) message = 'Marj %15 altına düştü.';
            else if (input.return_rate_pct > 12) message = 'İade oranı yüksek.';
            else message = 'Risk seviyesi orta/yüksek.';
        } else {
            // Only generate notifications for warnings and dangers
            return;
        }

        // Create a unique dedupe key to prevent duplicates
        // format: analysisId:type:message_hash
        const dedupeKey = `${id}:${type}:${message.substring(0, 20)}`;

        notifications.push({
            user_id: userId,
            analysis_id: id,
            type,
            category,
            title,
            message,
            is_read: false,
            dedupe_key: dedupeKey
        });
    });

    return notifications;
}
