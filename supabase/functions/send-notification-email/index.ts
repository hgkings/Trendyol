import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")

serve(async (req) => {
    try {
        const { record, table, type } = await req.json()

        // Only handle notifications table inserts
        if (table !== 'notifications' || type !== 'INSERT') {
            return new Response(JSON.stringify({ message: 'Skipped: Not a notification insert' }), { status: 200 })
        }

        // Only handle 'danger' notifications
        if (record.type !== 'danger') {
            return new Response(JSON.stringify({ message: 'Skipped: Not a danger notification' }), { status: 200 })
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        )

        // Check user's email preference
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email, email_alerts_enabled')
            .eq('id', record.user_id)
            .single()

        if (profileError || !profile || !profile.email_alerts_enabled) {
            return new Response(JSON.stringify({ message: 'Skipped: User disabled email alerts or not found' }), { status: 200 })
        }

        // Send email via Resend
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "Kar Kocu Alert <notifications@karkocu.tr>",
                to: [profile.email],
                subject: `KRİTİK RİSK BİLDİRİMİ: ${record.title}`,
                html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fee2e2; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #ef4444; padding: 20px; color: white; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">Kritik Risk Bildirimi</h1>
            </div>
            <div style="padding: 30px; background-color: white;">
              <h2 style="color: #111827; margin-top: 0;">${record.title}</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
                Ürününüz için kritik bir durum tespit edildi: 
                <br>
                <strong style="color: #dc2626;">${record.message}</strong>
              </p>
              <div style="margin-top: 30px;">
                <a href="${Deno.env.get("SITE_URL")}/analysis/${record.analysis_id}" 
                   style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                   Detayları Görüntüle
                </a>
              </div>
            </div>
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
              Bu bildirim, Kar Kocu ayarlarınızda "E-posta Bildirimleri" açık olduğu için gönderilmiştir.
            </div>
          </div>
        `,
            }),
        })

        const result = await res.json()
        return new Response(JSON.stringify(result), { status: 200 })
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
