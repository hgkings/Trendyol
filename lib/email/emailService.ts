import { Resend } from 'resend';
import { supabaseAdmin } from '../supabase-server-client';

// Ensure Resend is instantiated only if the key exists to prevent silent failures during init
if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY is not defined in environment variables.');
}

// We instantiate it, but calls will fail later if key is missing, which we catch.
const resend = new Resend(process.env.RESEND_API_KEY || 'missing_key');

// strict env check
const MAIL_FROM = process.env.MAIL_FROM || 'Kârnet <no-reply@karnet.com>';
const MAIL_REPLY_TO = process.env.MAIL_REPLY_TO || 'destek@karnet.com';

export interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
    tags?: { name: string; value: string }[];
    templateName: string; // Used for logging
    userId?: string;      // Used for logging
}

export const emailService = {
    /**
     * Sends an email using Resend and logs the result to Supabase.
     */
    async sendEmail({ to, subject, html, text, tags = [], templateName, userId }: SendEmailOptions) {

        // 1. Validate Environment
        if (!process.env.RESEND_API_KEY) {
            const errorMsg = 'RESEND_API_KEY is missing. Cannot send email.';
            console.error(errorMsg);
            await this.logEmailAttempt(userId, to, templateName, subject, 'failed', null, errorMsg);
            throw new Error(errorMsg);
        }

        // 2. Add default tags for Resend metrics
        const defaultTags = [{ name: 'template', value: templateName }];
        const mergedTags = [...defaultTags, ...tags];

        try {
            // 3. Send via Resend
            const { data, error } = await resend.emails.send({
                from: MAIL_FROM,
                to,
                replyTo: MAIL_REPLY_TO,
                subject,
                html,
                text: text || '', // Optional fallback
                tags: mergedTags
            });

            if (error) {
                console.error(`[Resend Error] Failed to send email to ${to}:`, error);
                await this.logEmailAttempt(userId, to, templateName, subject, 'failed', null, error.message);
                throw new Error(`Resend Error: ${error.message}`);
            }

            // 4. Log Success
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

    /**
     * Logs the email attempt to Supabase email_logs table.
     * Uses supabaseAdmin (Service Role) to bypass RLS since this runs on the server.
     */
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
            // Basic Supabase call. If supabaseAdmin fails (e.g., config error), we don't want it to crash the email flow completely, so we wrap it.
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
