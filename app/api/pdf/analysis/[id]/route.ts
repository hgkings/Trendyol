import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

/* ─── Formatting helpers ─── */
function fmt(v: unknown): string {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0,00";
    return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function tl(v: unknown) { return `${fmt(v)} TL`; }
function pct(v: unknown) { const n = Number(v); return `%${Number.isFinite(n) ? n.toFixed(1) : "0.0"}`; }

const MKT: Record<string, string> = {
    trendyol: "Trendyol", hepsiburada: "Hepsiburada", n11: "N11", amazon_tr: "Amazon TR", custom: "Ozel",
};

function trChar(t: string): string {
    return t
        .replace(/Ğ/g, "G").replace(/ğ/g, "g")
        .replace(/Ü/g, "U").replace(/ü/g, "u")
        .replace(/Ş/g, "S").replace(/ş/g, "s")
        .replace(/İ/g, "I").replace(/ı/g, "i")
        .replace(/Ö/g, "O").replace(/ö/g, "o")
        .replace(/Ç/g, "C").replace(/ç/g, "c");
}

export const dynamic = "force-dynamic";

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        /* ──────────────────────────────────
         * AUTH: Read Bearer token from header
         * ────────────────────────────────── */
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }

        const accessToken = authHeader.replace("Bearer ", "");

        // Create a Supabase client authenticated with the user's token
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: { headers: { Authorization: `Bearer ${accessToken}` } },
                auth: { persistSession: false, autoRefreshToken: false },
            }
        );

        // Verify the token is valid
        const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
        if (authError || !user) {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }

        // Plan check — ONLY select columns that exist in the profiles table
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("plan")
            .eq("id", user.id)
            .single();

        if (profileError) {
            console.error("[PDF Route] Profile fetch error:", profileError.message);
            return NextResponse.json({ error: "PRO_REQUIRED", detail: "Profile fetch failed" }, { status: 403 });
        }

        const plan = profile?.plan || "free";
        console.log(`[PDF Route] User: ${user.email}, Plan: ${plan}`);

        if (plan !== "pro") {
            console.warn(`[PDF Route] Access denied. Plan is '${plan}' but 'pro' is required.`);
            return NextResponse.json({ error: "PRO_REQUIRED", plan }, { status: 403 });
        }

        // Fetch analysis (scoped to user)
        const { data: row } = await supabase
            .from("analyses")
            .select("*")
            .eq("id", params.id)
            .eq("user_id", user.id)
            .single();

        if (!row) {
            return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        }

        // Extract data from JSONB columns
        const inputs = (row.inputs || {}) as Record<string, any>;
        const outputs = (row.outputs || {}) as Record<string, any>;
        const productName = row.product_name || inputs.product_name || "Urun";
        const marketplace = MKT[row.marketplace || inputs.marketplace] || row.marketplace || "";
        const createdAt = new Date(row.created_at).toLocaleDateString("tr-TR", {
            year: "numeric", month: "long", day: "numeric",
        });

        // ─── Build PDF ───
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const page = pdfDoc.addPage([595, 842]); // A4
        const W = 595;
        let y = 790;

        const DARK = rgb(0.12, 0.14, 0.18);
        const GRAY = rgb(0.4, 0.45, 0.5);
        const ACCENT = rgb(0.31, 0.27, 0.9);
        const GREEN = rgb(0.02, 0.59, 0.4);
        const RED = rgb(0.86, 0.15, 0.15);
        const LINE_CLR = rgb(0.88, 0.9, 0.92);
        const BG_LIGHT = rgb(0.97, 0.98, 0.99);

        const text = (t: string, x: number, yy: number, size: number, f = font, color = DARK) => {
            page.drawText(trChar(t), { x, y: yy, size, font: f, color });
        };

        const line = (yy: number) => {
            page.drawLine({ start: { x: 50, y: yy }, end: { x: W - 50, y: yy }, thickness: 0.5, color: LINE_CLR });
        };

        // ── HEADER ──
        text("Kar Kocu", 50, y, 22, fontBold, ACCENT);
        text("Analiz Raporu", 175, y, 22, font, GRAY);
        y -= 30;
        text(productName, 50, y, 16, fontBold);
        y -= 18;
        text(`${marketplace}  •  ${createdAt}${inputs.pro_mode ? "  •  Profesyonel Mod" : ""}`, 50, y, 9, font, GRAY);
        y -= 20;
        line(y);
        y -= 25;

        // ── SUMMARY ──
        const summaryItems = [
            { label: "Satis Fiyati", value: tl(inputs.sale_price) },
            { label: "Birim Net Kar", value: tl(outputs.unit_net_profit), profit: Number(outputs.unit_net_profit) },
            { label: "Kar Marji", value: pct(outputs.margin_pct), profit: Number(outputs.margin_pct) },
            { label: "Aylik Net Kar", value: tl(outputs.monthly_net_profit), profit: Number(outputs.monthly_net_profit) },
            { label: "Aylik Ciro", value: tl(outputs.monthly_revenue) },
            { label: "Basabas Fiyati", value: tl(outputs.breakeven_price) },
        ];

        text("OZET", 50, y, 11, fontBold, ACCENT);
        y -= 20;

        for (let i = 0; i < summaryItems.length; i += 3) {
            for (let j = 0; j < 3 && i + j < summaryItems.length; j++) {
                const item = summaryItems[i + j];
                const xOff = 50 + j * 170;
                page.drawRectangle({ x: xOff, y: y - 8, width: 155, height: 45, color: BG_LIGHT, borderColor: LINE_CLR, borderWidth: 0.5 });
                text(item.label, xOff + 10, y + 22, 7, font, GRAY);
                const valColor = item.profit !== undefined ? (item.profit >= 0 ? GREEN : RED) : DARK;
                text(item.value, xOff + 10, y + 5, 13, fontBold, valColor);
            }
            y -= 60;
        }

        y -= 10;

        // ── COST BREAKDOWN ──
        text("MALIYET DAGILIMI", 50, y, 11, fontBold, ACCENT);
        y -= 20;

        page.drawRectangle({ x: 50, y: y - 5, width: W - 100, height: 20, color: BG_LIGHT });
        text("Kalem", 60, y, 8, fontBold, GRAY);
        text("Tutar (TL)", W - 140, y, 8, fontBold, GRAY);
        y -= 25;

        const costRows = [
            { label: "Urun Maliyeti", value: inputs.product_cost },
            { label: `Komisyon (%${inputs.commission_pct || 0})`, value: outputs.commission_amount },
            { label: "KDV", value: outputs.vat_amount },
            { label: "Kargo", value: inputs.shipping_cost },
            { label: "Paketleme", value: inputs.packaging_cost },
            { label: "Reklam (birim)", value: inputs.ad_cost_per_sale },
            { label: `Iade Kaybi (%${inputs.return_rate_pct || 0})`, value: outputs.expected_return_loss },
            { label: "Diger Giderler", value: inputs.other_cost },
        ];

        costRows.forEach((r, i) => {
            if (i % 2 === 1) {
                page.drawRectangle({ x: 50, y: y - 5, width: W - 100, height: 18, color: BG_LIGHT });
            }
            text(r.label, 60, y, 9, font, DARK);
            text(fmt(r.value), W - 140, y, 9, fontBold, DARK);
            y -= 18;
        });

        line(y + 5);
        y -= 5;
        page.drawRectangle({ x: 50, y: y - 5, width: W - 100, height: 20, color: rgb(0.93, 0.95, 0.97) });
        text("Toplam Birim Maliyet", 60, y, 9, fontBold, DARK);
        text(fmt(outputs.unit_total_cost), W - 140, y, 10, fontBold, ACCENT);
        y -= 35;

        // ── NOTES ──
        page.drawRectangle({ x: 50, y: y - 20, width: W - 100, height: 40, color: rgb(1, 0.98, 0.93), borderColor: rgb(0.99, 0.95, 0.78), borderWidth: 0.5 });
        text("Bu rapor tahmini hesaplama icerir. Gercek sonuclar piyasa kosullari ve pazaryeri", 60, y - 2, 7, font, rgb(0.57, 0.25, 0.05));
        text("politika degisikliklerine bagli olarak farklilik gosterebilir.", 60, y - 12, 7, font, rgb(0.57, 0.25, 0.05));

        // ── FOOTER ──
        text("Kar Kocu - Profesyonel Satici Analiz Platformu", 50, 30, 7, font, GRAY);
        text(createdAt, W - 150, 30, 7, font, GRAY);

        // ── Serialize ──
        const pdfBytes = await pdfDoc.save();

        const safeName = productName
            .replace(/[^a-zA-Z0-9_\-\u00C0-\u024F]/g, "-")
            .slice(0, 50);

        return new NextResponse(pdfBytes as any, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="kar-kocu-${safeName}-${params.id.slice(0, 8)}.pdf"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        console.error("[PDF Route Error]", err);
        return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
    }
}
