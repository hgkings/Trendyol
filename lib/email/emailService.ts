import { sendEmail as smtpSendEmail } from './smtp';
import { getWelcomeTemplate } from './templates/welcome';
import { getEmailVerifyTemplate } from './templates/email-verify';
import { getPasswordResetTemplate } from './templates/password-reset';
import { getProActivatedTemplate } from './templates/pro-activated';
import { getProExpiryWarningTemplate } from './templates/pro-expiry-warning';
import { getProExpiredTemplate } from './templates/pro-expired';
import { getWeeklyReportTemplate, getRiskAlertTemplate, getMarginAlertTemplate } from './templates/notifications';

// Lazy Supabase admin — only import when actually needed
async function getSupabaseAdmin() {
    const { createAdminClient } = await import('../supabase/admin');
    return createAdminClient();
}

const MAIL_REPLY_TO = () => process.env.MAIL_REPLY_TO || 'karnet.destek@gmail.com';

export interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
    tags?: { name: string; value: string }[];
    templateName: string;
    userId?: string;
}

interface UserInfo {
    email: string;
    name?: string;
    id?: string;
}

/**
 * Check if user has opted in for a specific email preference
 */
async function checkEmailPreference(userId: string | undefined, column: string): Promise<boolean> {
    if (!userId) return true;
    try {
        const supabaseAdmin = await getSupabaseAdmin();
        const { data } = await supabaseAdmin
            .from('profiles')
            .select(column)
            .eq('id', userId)
            .single();
        if (!data) return true;
        return (data as unknown as Record<string, unknown>)[column] !== false;
    } catch {
        return true;
    }
}

export const emailService = {
    async sendEmail({ to, subject, html, text, templateName, userId }: SendEmailOptions) {

        if (!process.env.BREVO_SMTP_USER || !process.env.BREVO_SMTP_KEY) {
            const errorMsg = 'BREVO_SMTP_USER veya BREVO_SMTP_KEY eksik. E-posta gönderilemez.';
            console.error(errorMsg);
            await this.logEmailAttempt(userId, to, templateName, subject, 'failed', null, errorMsg);
            throw new Error(errorMsg);
        }

        try {
            const result = await smtpSendEmail({
                to,
                subject,
                html,
                text,
                replyTo: MAIL_REPLY_TO(),
            });

            if (!result.success) {
                const errorMsg = String(result.error) || 'SMTP gönderim hatası';
                console.error(`[SMTP Error] Failed to send email to ${to}:`, result.error);
                await this.logEmailAttempt(userId, to, templateName, subject, 'failed', null, errorMsg);
                throw new Error(`SMTP Error: ${errorMsg}`);
            }

            console.log(`[Email Sent] Successfully sent ${templateName} to ${to} (ID: ${result.messageId})`);
            await this.logEmailAttempt(userId, to, templateName, subject, 'sent', result.messageId || null, null);
            return { success: true, provider_message_id: result.messageId };

        } catch (err: any) {
            console.error(`[Email Service Exception] Failed to send email to ${to}:`, err);
            await this.logEmailAttempt(userId, to, templateName, subject, 'failed', null, err.message);
            throw err;
        }
    },

    async logEmailAttempt(
        userId: string | undefined,
        toEmail: string,
        template: string,
        subject: string,
        status: 'sent' | 'failed',
        providerId: string | null | undefined,
        errorMsg: string | null
    ) {
        try {
            const supabaseAdmin = await getSupabaseAdmin();
            const { error } = await supabaseAdmin
                .from('email_logs')
                .insert({
                    user_id: userId || null,
                    to_email: toEmail,
                    template: template,
                    subject: subject,
                    status: status,
                    provider: 'brevo',
                    provider_message_id: providerId || null,
                    error: errorMsg
                });

            if (error) console.error('[DB Log Error] Failed to insert email_log:', error);
        } catch (dbErr) {
            console.error('[DB Log Exception] Failed to write to email_logs:', dbErr);
        }
    },

    // ── Zorunlu Mailler (tercih kontrolü yapılmaz) ──

    async sendWelcomeEmail(user: UserInfo) {
        const template = getWelcomeTemplate(user.name || '');
        return this.sendEmail({
            to: user.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
            templateName: 'welcome',
            userId: user.id,
        });
    },

    async sendEmailVerification(user: UserInfo, verificationUrl: string) {
        const template = getEmailVerifyTemplate(verificationUrl);
        return this.sendEmail({
            to: user.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
            templateName: 'email_verify',
            userId: user.id,
        });
    },

    async sendPasswordReset(user: UserInfo, resetUrl: string) {
        const template = getPasswordResetTemplate(resetUrl);
        return this.sendEmail({
            to: user.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
            templateName: 'password_reset',
            userId: user.id,
        });
    },

    async sendProActivated(user: UserInfo, options: { planType: string; expiresAt: string }) {
        const template = getProActivatedTemplate(options.planType, options.expiresAt);
        return this.sendEmail({
            to: user.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
            templateName: 'pro_activated',
            userId: user.id,
        });
    },

    async sendProExpired(user: UserInfo) {
        const template = getProExpiredTemplate();
        return this.sendEmail({
            to: user.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
            templateName: 'pro_expired',
            userId: user.id,
        });
    },

    // ── Tercihli Mailler (kullanıcı tercihi kontrol edilir) ──

    async sendProExpiryWarning(user: UserInfo, options: { daysLeft: number; expiresAt: string }) {
        const allowed = await checkEmailPreference(user.id, 'email_pro_expiry');
        if (!allowed) {
            console.log(`[Email Skip] Pro expiry warning skipped for ${user.email} (preference disabled)`);
            return { success: false, skipped: true };
        }
        const template = getProExpiryWarningTemplate(options.daysLeft, options.expiresAt);
        return this.sendEmail({
            to: user.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
            templateName: 'pro_expiry_warning',
            userId: user.id,
        });
    },

    async sendWeeklyReport(user: UserInfo, stats: {
        analysisCount: number;
        topProduct?: { name: string; margin: number };
        riskProduct?: { name: string };
    }) {
        const allowed = await checkEmailPreference(user.id, 'email_weekly_report');
        if (!allowed) {
            console.log(`[Email Skip] Weekly report skipped for ${user.email} (preference disabled)`);
            return { success: false, skipped: true };
        }
        const template = getWeeklyReportTemplate(user.name || '', stats);
        return this.sendEmail({
            to: user.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
            templateName: 'weekly_report',
            userId: user.id,
        });
    },

    async sendRiskAlert(user: UserInfo, options: { productName: string; currentPrice?: number; loss: number }) {
        const allowed = await checkEmailPreference(user.id, 'email_risk_alert');
        if (!allowed) {
            console.log(`[Email Skip] Risk alert skipped for ${user.email} (preference disabled)`);
            return { success: false, skipped: true };
        }
        const template = getRiskAlertTemplate(options.productName, options.currentPrice || 0, options.loss);
        return this.sendEmail({
            to: user.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
            templateName: 'risk_alert',
            userId: user.id,
        });
    },

    async sendMarginAlert(user: UserInfo, options: { productName: string; currentMargin: number; targetMargin: number }) {
        const allowed = await checkEmailPreference(user.id, 'email_margin_alert');
        if (!allowed) {
            console.log(`[Email Skip] Margin alert skipped for ${user.email} (preference disabled)`);
            return { success: false, skipped: true };
        }
        const template = getMarginAlertTemplate(options.productName, options.currentMargin, options.targetMargin);
        return this.sendEmail({
            to: user.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
            templateName: 'margin_alert',
            userId: user.id,
        });
    },
};
