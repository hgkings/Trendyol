import { Resend } from 'resend';

// Lazy Resend instantiation — only create when actually needed
let _resend: Resend | null = null;
function getResend(): Resend {
    if (!_resend) {
        _resend = new Resend(process.env.RESEND_API_KEY || 'missing_key');
    }
    return _resend;
}

// Lazy Supabase admin — only import when actually needed
async function getSupabaseAdmin() {
    const { supabaseAdmin } = await import('../supabase-server-client');
    return supabaseAdmin;
}

const MAIL_FROM = () => process.env.MAIL_FROM || 'Kârnet <no-reply@karnet.com>';
const MAIL_REPLY_TO = () => process.env.MAIL_REPLY_TO || 'destek@karnet.com';

export interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
    tags?: { name: string; value: string }[];
    templateName: string;
    userId?: string;
}

export const emailService = {
    async sendEmail({ to, subject, html, text, tags = [], templateName, userId }: SendEmailOptions) {

        if (!process.env.RESEND_API_KEY) {
            const errorMsg = 'RESEND_API_KEY is missing. Cannot send email.';
            console.error(errorMsg);
            await this.logEmailAttempt(userId, to, templateName, subject, 'failed', null, errorMsg);
            throw new Error(errorMsg);
        }

        const defaultTags = [{ name: 'template', value: templateName }];
        const mergedTags = [...defaultTags, ...tags];

        try {
            const resend = getResend();
            const { data, error } = await resend.emails.send({
                from: MAIL_FROM(),
                to,
                replyTo: MAIL_REPLY_TO(),
                subject,
                html,
                text: text || '',
                tags: mergedTags
            });

            if (error) {
                console.error(`[Resend Error] Failed to send email to ${to}:`, error);
                await this.logEmailAttempt(userId, to, templateName, subject, 'failed', null, error.message);
                throw new Error(`Resend Error: ${error.message}`);
            }

            if (data && data.id) {
                console.log(`[Email Sent] Successfully sent ${templateName} to ${to} (ID: ${data.id})`);
                await this.logEmailAttempt(userId, to, templateName, subject, 'sent', data.id, null);
                return { success: true, provider_message_id: data.id };
            }

            throw new Error('No data ID returned from Resend');

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
        providerId: string | null,
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
                    provider: 'resend',
                    provider_message_id: providerId,
                    error: errorMsg
                });

            if (error) console.error('[DB Log Error] Failed to insert email_log:', error);
        } catch (dbErr) {
            console.error('[DB Log Exception] Failed to write to email_logs:', dbErr);
        }
    }
};
