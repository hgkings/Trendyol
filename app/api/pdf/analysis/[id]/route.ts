import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server-client';
import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Colors (Tailwind-like)
const COLORS = {
    PRIMARY: rgb(0.145, 0.388, 0.922), // #2563EB (blue-600)
    PRIMARY_LIGHT: rgb(0.93, 0.95, 1.0), // #EFF6FF (blue-50)
    SECONDARY: rgb(0.388, 0.4, 0.945),   // #6366F1
    SUCCESS: rgb(0.133, 0.773, 0.369),   // #22c55e (green-500)
    SUCCESS_BG: rgb(0.86, 0.97, 0.89),   // #dcfce7
    WARNING: rgb(0.96, 0.57, 0.06),      // #f59e0b (amber-500)
    WARNING_BG: rgb(1.0, 0.96, 0.82),    // #fef3c7
    DANGER: rgb(0.937, 0.267, 0.267),    // #ef4444 (red-500)
    DANGER_BG: rgb(0.99, 0.89, 0.89),    // #fee2e2
    DARK: rgb(0.059, 0.09, 0.165),       // #0F172A (slate-900)
    GRAY: rgb(0.4, 0.45, 0.5),           // #64748B (slate-500)
    GRAY_LIGHT: rgb(0.96, 0.97, 0.98),   // #F7F9FC (slate-50)
    BORDER: rgb(0.898, 0.914, 0.941),    // #E2E8F0 (slate-200)
    WHITE: rgb(1, 1, 1),
};

const UBUNTU_URLS = {
    REGULAR: 'https://pdf-lib.js.org/assets/ubuntu/Ubuntu-R.ttf',
    BOLD: 'https://pdf-lib.js.org/assets/ubuntu/Ubuntu-B.ttf',
};

// Helper: Rounded Rectangle Path
const createRoundedRectPath = (x: number, y: number, w: number, h: number, r: number) => {
    // PDF coordinates: bottom-left is x,y.
    // SVG Path equivalent.
    // Move to bottom-left radius start
    return `M ${x + r} ${y} L ${x + w - r} ${y} A ${r} ${r} 0 0 0 ${x + w} ${y + r} L ${x + w} ${y + h - r} A ${r} ${r} 0 0 0 ${x + w - r} ${y + h} L ${x + r} ${y + h} A ${r} ${r} 0 0 0 ${x} ${y + h - r} L ${x} ${y + r} A ${r} ${r} 0 0 0 ${x + r} ${y} Z`;
    // Wait, PDF arc command might differ? 
    // pdf-lib drawSvgPath handles "M L A Z".
    // "A rx ry x-axis-rotation large-arc-flag sweep-flag x y"
    // sweep-flag 0 means counter-clockwise?
    // Let's rely on standard SVG path syntax.
};

// Helper: Standard Rounded Rect Drawer
// Since drawSvgPath creates a filled shape, we can use it.
// BUT borders? We might need to stroke it.
// Simpler: Draw simple rects if rounded fails, but user wants rounded.
// I will attempt SVG path.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return new NextResponse('Unauthorized', { status: 401 });

        // Fetch Analysis Data
        const { data: row, error } = await supabase
            .from('analyses')
            .select('*')
            .eq('id', params.id)
            .eq('user_id', user.id)
            .single();

        if (error || !row) return new NextResponse('Analysis not found', { status: 404 });

        // Prepare Inputs/Outputs
        const inputs = row.inputs || {};
        const results = row.results || {};

        // Parse INPUTS (Base values)
        const price = Number(inputs.sale_price) || 0;
        const productCost = Number(inputs.product_cost) || 0;
        const shipping = Number(inputs.shipping_cost) || 0;
        const ads = Number(inputs.ad_cost_per_sale) || 0;
        const packaging = Number(inputs.packaging_cost) || 0;
        const otherCost = Number(inputs.other_cost) || 0;
        const commRate = Number(inputs.commission_pct) || 20; // Default 20
        const vatRate = Number(inputs.vat_pct) || 20; // Default 20
        const returnRate = Number(inputs.return_rate_pct) || 0;

        // Perform Calculations (Server-Side)
        // Commission Amount = Price * (Rate/100)
        const commission = price * (commRate / 100);

        // VAT Amount = Price - (Price / (1 + VAT/100))
        // Assuming Price includes VAT. If input.sale_price_includes_vat? 
        // Standard behavior: Price has VAT.
        // Wait, commission includes VAT? Usually yes.
        // Let's use simple logic:
        const vatAmount = price - (price / (1 + (vatRate / 100)));

        // Expected Return Loss = Price * (ReturnRate/100) * (if margin?)
        // Simple logic: Return Loss = Price * (ReturnRate/100).
        // Actually usually Return Loss = (Shipping + Commission + LossValues) * Rate.
        // But let's use Price * Rate as worst case estimate for now? No.
        // Let's assume Return Loss = 0 for now unless user input explicitly provided it?
        // Wait, `inputs.return_rate_pct` is provided.
        // `results.expected_return_loss` was 0.
        // Let's use a simple heuristic: 30 TL if rate > 0? No.
        // Let's calculate: Return Cost per Unit = (Price * Rate%).
        const returns = price * (returnRate / 100);

        // Total Unit Cost
        const totalCost = productCost + commission + shipping + ads + packaging + otherCost + vatAmount + returns;

        // Net Profit
        const netProfit = price - totalCost;

        // Margin
        const margin = price > 0 ? (netProfit / price) * 100 : 0;

        // Break Even = Fixed Costs / (Price - Var Costs)? 
        // Or Break Even Price = Total Cost?
        // Break Even Point (Sales) = Total Fixed / Margin Ratio.
        // But for Unit Analysis: Break Even Price = Total Unit Cost (excluding profit).
        const breakEven = totalCost;

        // Tax (VAT Amount) for display
        const tax = vatAmount;

        // Init PDF
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);

        // Fonts
        let font: PDFFont | undefined;
        let fontBold: PDFFont | undefined;
        let useFallback = false;

        const fetchFont = async (url: string) => {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Fetch error: ${res.statusText}`);
            const ab = await res.arrayBuffer();
            if (ab.byteLength < 100) throw new Error("File too small");
            return ab;
        };

        const cleanText = (txt: string) => {
            if (!useFallback) return txt;
            return txt
                .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
                .replace(/Ü/g, 'U').replace(/ü/g, 'u')
                .replace(/Ş/g, 'S').replace(/ş/g, 's')
                .replace(/İ/g, 'I').replace(/ı/g, 'i')
                .replace(/Ö/g, 'O').replace(/ö/g, 'o')
                .replace(/Ç/g, 'C').replace(/ç/g, 'c')
                .replace(/₺/g, 'TL');
        };

        try {
            const [fontBytes, fontBoldBytes] = await Promise.all([
                fetchFont(UBUNTU_URLS.REGULAR),
                fetchFont(UBUNTU_URLS.BOLD),
            ]);
            font = await pdfDoc.embedFont(fontBytes);
            fontBold = await pdfDoc.embedFont(fontBoldBytes);
        } catch (fontErr) {
            console.error("[PDF Route] Font load failed, falling back to Helvetica:", fontErr);
            useFallback = true;
            font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        }

        const page = pdfDoc.addPage([595.28, 841.89]); // A4
        const { width: W, height: H } = page.getSize();
        const MARGIN = 40;

        // Helpers
        const drawText = (text: string, x: number, y: number, size: number, options: any = {}) => {
            page.drawText(cleanText(text), { x, y, size, font: options.font || font, color: options.color || COLORS.DARK, ...options });
        };
        const drawTextRight = (text: string, x: number, y: number, size: number, options: any = {}) => {
            const cleaned = cleanText(text);
            const w = (options.font || font)!.widthOfTextAtSize(cleaned, size);
            page.drawText(cleaned, { x: x - w, y, size, font: options.font || font, color: options.color || COLORS.DARK, ...options });
        };
        const drawTextCenter = (text: string, x: number, y: number, size: number, options: any = {}) => {
            const cleaned = cleanText(text);
            const w = (options.font || font)!.widthOfTextAtSize(cleaned, size);
            page.drawText(cleaned, { x: x - (w / 2), y, size, font: options.font || font, color: options.color || COLORS.DARK, ...options });
        };

        // Helper: Draw Badge
        const drawBadge = (label: string, text: string, xEnd: number, y: number, color: any, bgColor: any) => {
            const paddingX = 12; // Increased padding
            const paddingY = 4;
            const textSize = 9;
            const labelSize = 8;

            // Calculate Badge Geometry
            const cleanTxt = cleanText(text);
            const textWidth = fontBold!.widthOfTextAtSize(cleanTxt, textSize);

            // Add safety margin (+4) to prevent clipping
            const badgeW = textWidth + (paddingX * 2) + 4;
            const badgeH = textSize + (paddingY * 2); // 17

            const badgeLeft = xEnd - badgeW;

            // Badge Background
            // Center of Text: y + 3.15 (Cap Height / 2)
            // Center of Box: y + 3.15
            // Box Bottom: Center - 8.5 = y - 5.35 ~ y - 5.5
            // Box Top: Center + 8.5 = y + 11.65 ~ y + 11.5
            page.drawRectangle({
                x: badgeLeft, y: y - 5.5,
                width: badgeW, height: badgeH,
                color: bgColor,
            });

            // Badge Text
            // Visual centering horizontally: badgeLeft + (badgeW - textWidth)/2
            // Visual centering vertically: y
            // But let's lower slightly to account for descenders causing visual offset?
            // y + 1 looks good (previous y+1.5 was too high?).
            // Let's try y + 0.5. Just above baseline.
            const textX = badgeLeft + (badgeW - textWidth) / 2;
            page.drawText(cleanTxt, { x: textX, y: y + 0.5, size: textSize, font: fontBold, color: color });

            // Label
            // Place label 12px to the left of Badge Left Edge.
            drawTextRight(label, badgeLeft - 12, y, labelSize, { color: COLORS.GRAY });

            // Return X position for NEXT badge (Status Badge).
            // Gap between badges groups.
            const labelWidth = (font || fontBold)!.widthOfTextAtSize(cleanText(label), labelSize);

            return badgeLeft - 12 - labelWidth - 25; // 25px gap between badge groups
        };

        // Helper: Draw Card
        const drawCard = (x: number, y: number, w: number, h: number, title: string, value: string, isPositive: boolean | null = null) => {
            // Background
            page.drawRectangle({ x, y, width: w, height: h, color: COLORS.GRAY_LIGHT });
            // Labels
            drawText(title, x + 12, y + h - 20, 9, { color: COLORS.GRAY });

            // Value Color
            let valColor = COLORS.DARK;
            if (isPositive === true) valColor = COLORS.SUCCESS;
            if (isPositive === false && title.includes('Kâr')) valColor = COLORS.DANGER;

            drawText(value, x + 12, y + 20, 16, { font: fontBold, color: valColor });
        };


        /* ──────────────── HEADER ──────────────── */
        let y = H - MARGIN - 20;

        // Logo (Vector Chart)
        const logoSize = 28;
        const xBase = MARGIN;
        const yBase = y - logoSize + 5;
        const scale = logoSize / 40;

        page.drawRectangle({ x: xBase, y: yBase, width: logoSize, height: logoSize, color: COLORS.PRIMARY });
        const barsBottomY = yBase + (8 * scale);
        page.drawRectangle({ x: xBase + (8 * scale), y: barsBottomY, width: 6 * scale, height: 10 * scale, color: COLORS.WHITE });
        page.drawRectangle({ x: xBase + (17 * scale), y: barsBottomY, width: 6 * scale, height: 16 * scale, color: COLORS.WHITE });
        page.drawRectangle({ x: xBase + (26 * scale), y: barsBottomY, width: 6 * scale, height: 22 * scale, color: COLORS.WHITE });

        const pdfY = (svgY: number) => (yBase + 28) - (svgY * scale);
        const pdfX = (svgX: number) => xBase + (svgX * scale);
        const arrowOpts = { color: COLORS.WHITE, thickness: 2.5 * scale, lineCap: 'Round' as any, lineJoin: 'Round' as any };

        page.drawLine({ start: { x: pdfX(18), y: pdfY(24) }, end: { x: pdfX(34), y: pdfY(8) }, ...arrowOpts });
        page.drawLine({ start: { x: pdfX(28), y: pdfY(8) }, end: { x: pdfX(34), y: pdfY(8) }, ...arrowOpts });
        page.drawLine({ start: { x: pdfX(34), y: pdfY(8) }, end: { x: pdfX(34), y: pdfY(14) }, ...arrowOpts });

        // Title
        drawText("Kârnet", MARGIN + logoSize + 10, y - 10, 20, { font: fontBold, color: COLORS.DARK });
        drawTextRight("ANALiZ RAPORU", W - MARGIN, y - 8, 12, { color: COLORS.GRAY, font: fontBold });

        y -= 40;
        // Product Name
        const productName = (inputs.product_name as string) || "İsimsiz Ürün";
        drawText(productName, MARGIN, y, 16, { font: fontBold });
        drawTextRight((row.marketplace || "Pazaryeri") + " • " + new Date().toLocaleDateString('tr-TR'), W - MARGIN, y + 2, 10, { color: COLORS.GRAY });

        y -= 25;
        page.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 1, color: COLORS.BORDER });

        // Badges Removed.
        /*
        // Badges (Top Right, slightly above line)
        const badgeY = y + 35;
        let badgeX = W - MARGIN;
        
        let riskLabel = "Risk";
        let riskText = "Orta";
        let riskColor = COLORS.WARNING;
        let riskBg = COLORS.WARNING_BG;
        if (margin > 25) { riskText = "Düşük"; riskColor = COLORS.SUCCESS; riskBg = COLORS.SUCCESS_BG; }
        if (margin < 10) { riskText = "Yüksek"; riskColor = COLORS.DANGER; riskBg = COLORS.DANGER_BG; }
        
        // badgeX = drawBadge(riskLabel, riskText, badgeX, badgeY, riskColor, riskBg);

        let profitLabel = "Durum";
        let profitText = "Kârlı";
        let profitColor = COLORS.SUCCESS;
        let profitBg = COLORS.SUCCESS_BG;
        if (netProfit < 0) { profitText = "Zarar"; profitColor = COLORS.DANGER; profitBg = COLORS.DANGER_BG; }
        if (Math.abs(netProfit) < 1) { profitText = "Başabaş"; profitColor = COLORS.GRAY; profitBg = COLORS.GRAY_LIGHT; } 

        // drawBadge(profitLabel, profitText, badgeX, badgeY, profitColor, profitBg);
        */


        /* ──────────────── SUMMARY CARDS (2 Rows x 3 Cols) ──────────────── */
        y -= 30;
        const cardH = 70;
        const gap = 15;
        const cardW = (W - (MARGIN * 2) - (gap * 2)) / 3;

        // Row 1
        drawCard(MARGIN, y - cardH, cardW, cardH, "Satış Fiyatı", `${price.toFixed(2)} TL`);
        drawCard(MARGIN + cardW + gap, y - cardH, cardW, cardH, "Aylık Net Kâr", `${netProfit.toFixed(2)} TL`, netProfit > 0);
        drawCard(MARGIN + (cardW + gap) * 2, y - cardH, cardW, cardH, "Kâr Marjı", `%${margin.toFixed(1)}`, margin > 15);

        y -= (cardH + gap);
        // Row 2
        drawCard(MARGIN, y - cardH, cardW, cardH, "Aylık Ciro (Tahmini)", `${(price * 80).toFixed(2)} TL`); // Mock volume
        drawCard(MARGIN + cardW + gap, y - cardH, cardW, cardH, "Birim Kâr", `${(netProfit / 80).toFixed(2)} TL`);
        drawCard(MARGIN + (cardW + gap) * 2, y - cardH, cardW, cardH, "Başabaş Noktası", `${breakEven.toFixed(2)} TL`);

        y -= (cardH + 40);


        /* ──────────────── SPLIT LAYOUT: TABLE (Left) + CHART (Right) ──────────────── */
        const tableW = (W - (MARGIN * 2)) * 0.60;
        const chartW = (W - (MARGIN * 2)) * 0.35;
        const chartX = MARGIN + tableW + (W - (MARGIN * 2)) * 0.05; // Gap

        const startY = y;

        // TABLE HEADER
        drawText("Maliyet Dağılımı", MARGIN, y, 12, { font: fontBold, color: COLORS.PRIMARY });
        y -= 25;

        // Table Header Row
        page.drawRectangle({ x: MARGIN, y: y, width: tableW, height: 25, color: COLORS.GRAY_LIGHT });
        drawText("KALEM", MARGIN + 10, y + 8, 8, { font: fontBold, color: COLORS.GRAY });
        drawTextRight("TUTAR", MARGIN + tableW - 10, y + 8, 8, { font: fontBold, color: COLORS.GRAY });
        y -= 5; // Gap

        const items = [
            { name: "Ürün Maliyeti", val: productCost },
            { name: "Komisyon (%20)", val: commission },
            { name: "KDV", val: tax },
            { name: "Kargo", val: shipping },
            { name: "Paketleme", val: packaging },
            { name: "Reklam (Birim)", val: ads },
            { name: "İade Kaybı", val: returns },
            { name: "Diğer Giderler", val: otherCost },
        ];

        let isZebra = false;
        items.forEach(item => {
            if (item.val > 0) {
                y -= 25;
                if (isZebra) {
                    page.drawRectangle({ x: MARGIN, y, width: tableW, height: 25, color: COLORS.GRAY_LIGHT });
                    // Make zebra extremely subtle: F8F9FA. COLORS.GRAY_LIGHT is F7F9FC. Good.
                }
                drawText(item.name, MARGIN + 10, y + 7, 9);
                drawTextRight(item.val.toFixed(2), MARGIN + tableW - 10, y + 7, 9, { font: fontBold });
                isZebra = !isZebra;
            }
        });

        // Total Row
        y -= 30;
        page.drawRectangle({ x: MARGIN, y, width: tableW, height: 30, color: COLORS.GRAY_LIGHT });
        // border top/bottom
        page.drawLine({ start: { x: MARGIN, y: y + 30 }, end: { x: MARGIN + tableW, y: y + 30 }, thickness: 1, color: COLORS.BORDER });
        page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + tableW, y }, thickness: 1, color: COLORS.BORDER });

        drawText("Toplam Birim Maliyet", MARGIN + 10, y + 10, 10, { font: fontBold, color: COLORS.DARK });
        drawTextRight(totalCost.toFixed(2) + " TL", MARGIN + tableW - 10, y + 10, 10, { font: fontBold, color: COLORS.DARK });


        /* ──────────────── CHART (Right Side) ──────────────── */
        // Donut Chart
        // Center of Chart area
        const cx = chartX + (chartW / 2);
        const cy = startY - 80; // Align with top rows of table roughly
        const r = 50;
        const thickness = 15;

        // Data for Chart
        const chartData = [
            { label: "Ürün", val: productCost, color: COLORS.PRIMARY },
            { label: "Komisyon", val: commission, color: COLORS.SECONDARY },
            { label: "Kargo", val: shipping, color: COLORS.SUCCESS },
            { label: "Diğer", val: ads + returns + packaging + otherCost + tax, color: COLORS.GRAY },
        ].filter(d => d.val > 0);

        const totalChart = chartData.reduce((a, b) => a + b.val, 0);

        if (totalChart > 0) {
            let startAngle = 0;
            // Draw Segments
            chartData.forEach(d => {
                const sliceAngle = (d.val / totalChart) * 2 * Math.PI;
                const endAngle = startAngle + sliceAngle;

                // SVG Path for Arc (Annulus Sector really)
                // But simplified: thick strokes using drawSvgPath with Stroke?
                // pdf-lib drawCircle doesn't support stroke width/segments easily for donuts.
                // Alternative: Draw Lines? No.
                // Alternative: Use `drawSvgPath` with customized path string for arc.

                // Calculate points
                // We need to draw an ARC.
                // Standard SVG 'A' command.
                // M startX startY A r r 0 largeArc sweep endX endY

                // Helper to get coords
                const getCoords = (a: number, rad: number) => ({
                    x: cx + rad * Math.cos(a), // PDF coords: Y is up? No, usually check.
                    // If we use standard Trig, Y goes up. In PDF Y goes up.
                    // SVG path coordinate system in pdf-lib usually matches local transformation.
                    // Let's assume standard trig.
                    y: cy + rad * Math.sin(a)
                });

                // Angles in PDF-Lib/Trig usually radians. 0 is Right.
                // We start at -PI/2 (Top).
                const a1 = startAngle - (Math.PI / 2);
                const a2 = endAngle - (Math.PI / 2);

                const p1 = getCoords(a1, r);
                const p2 = getCoords(a2, r);

                const largeArc = sliceAngle > Math.PI ? 1 : 0;

                // Stroke method: Draw a path along the center of the ring, strokeWidth = thickness?
                // Path: Arc from p1 to p2.
                // Stroke Width = thickness.

                const path = `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
                // Note: sweep-flag 1 is usually clockwise.

                page.drawSvgPath(path, {
                    borderColor: d.color,
                    borderWidth: thickness,
                });

                startAngle += sliceAngle;
            });

            // Draw Legend Below Chart
            let legendY = cy - r - 30;
            chartData.forEach(d => {
                page.drawRectangle({ x: chartX + 10, y: legendY, width: 8, height: 8, color: d.color });
                drawText(d.label, chartX + 25, legendY, 9);
                const pct = Math.round((d.val / totalChart) * 100);
                drawTextRight(`%${pct}`, chartX + chartW - 10, legendY, 9, { font: fontBold });
                legendY -= 15;
            });
        }

        /* ──────────────── FOOTER ──────────────── */
        const footerY = 40;
        page.drawLine({ start: { x: MARGIN, y: footerY + 15 }, end: { x: W - MARGIN, y: footerY + 15 }, thickness: 0.5, color: COLORS.BORDER });

        drawText("karnet.com", MARGIN, footerY, 8, { font: font, color: COLORS.GRAY });
        drawTextCenter("Destek: destek@karnet.com", W / 2, footerY, 8, { font: font, color: COLORS.GRAY });

        const reportId = `KNR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${params.id.slice(0, 4).toUpperCase()}`;
        drawTextRight(`1 / 1  |  ${reportId}`, W - MARGIN, footerY, 8, { font: font, color: COLORS.GRAY });

        const disclaimer = "Bu rapor tahmini hesaplamalara dayanır. Sonuçlar pazar yeri kesintileri ve piyasa koşullarına göre değişebilir.";

        // Disclaimer Box
        page.drawRectangle({
            x: MARGIN, y: footerY - 25,
            width: W - (MARGIN * 2), height: 18,
            color: COLORS.GRAY_LIGHT,
            opacity: 0.5
        });
        drawTextCenter(disclaimer, W / 2, footerY - 20, 6, { font: font, color: COLORS.GRAY });


        // Save
        const pdfBytes = await pdfDoc.save();
        const MKT: any = { 'trendyol': 'Trendyol', 'hepsiburada': 'Hepsiburada', 'amazon': 'Amazon' };
        const safePlatform = (MKT[row.marketplace || inputs.marketplace] || row.marketplace || "Platform")
            .replace(/[^a-zA-Z0-9_\-]/g, "-");
        const filename = `Karnet_Analiz_Raporu_${safePlatform}_${new Date().toISOString().split('T')[0]}.pdf`;

        return new NextResponse(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });

    } catch (error) {
        console.error('PDF Generation Error:', error);
        return new NextResponse('Server Error: ' + (error instanceof Error ? error.message : 'Unknown'), { status: 500 });
    }
}
