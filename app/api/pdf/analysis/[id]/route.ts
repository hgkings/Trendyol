import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// ─── Renkler ───
const C = {
  PRIMARY: rgb(0.851, 0.471, 0.024),    // #D97706 amber-600
  PRIMARY_DARK: rgb(0.573, 0.251, 0.055), // #92400E amber-900
  SUCCESS: rgb(0.133, 0.773, 0.369),     // #22c55e
  SUCCESS_BG: rgb(0.86, 0.97, 0.89),
  DANGER: rgb(0.937, 0.267, 0.267),      // #ef4444
  DANGER_BG: rgb(0.99, 0.89, 0.89),
  WARNING: rgb(0.96, 0.57, 0.06),        // #f59e0b
  WARNING_BG: rgb(1.0, 0.96, 0.82),
  DARK: rgb(0.059, 0.09, 0.165),         // #0F172A
  TEXT: rgb(0.2, 0.23, 0.28),            // #334155
  GRAY: rgb(0.4, 0.45, 0.5),
  GRAY_LIGHT: rgb(0.96, 0.97, 0.98),
  BORDER: rgb(0.88, 0.9, 0.93),
  WHITE: rgb(1, 1, 1),
  BG_DARK: rgb(0.05, 0.05, 0.07),       // koyu arka plan
  ACCENT: rgb(0.98, 0.95, 0.88),        // krem
};

const FONT_URLS = {
  REGULAR: 'https://pdf-lib.js.org/assets/ubuntu/Ubuntu-R.ttf',
  BOLD: 'https://pdf-lib.js.org/assets/ubuntu/Ubuntu-B.ttf',
};

function n(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || fallback;
  return fallback;
}

function fmt(val: number): string {
  return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(val: number): string {
  return `%${val.toFixed(1)}`;
}

function riskLabel(level: string): string {
  const map: Record<string, string> = {
    safe: 'Düşük', moderate: 'Orta', risky: 'Yüksek', dangerous: 'Kritik'
  };
  return map[level] || 'Bilinmiyor';
}

function riskColor(level: string) {
  if (level === 'safe') return C.SUCCESS;
  if (level === 'moderate') return C.WARNING;
  if (level === 'risky' || level === 'dangerous') return C.DANGER;
  return C.GRAY;
}

function riskBg(level: string) {
  if (level === 'safe') return C.SUCCESS_BG;
  if (level === 'moderate') return C.WARNING_BG;
  return C.DANGER_BG;
}

const marketplaceLabel: Record<string, string> = {
  trendyol: 'Trendyol', hepsiburada: 'Hepsiburada',
  n11: 'N11', amazon_tr: 'Amazon TR', custom: 'Diğer',
};

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new NextResponse('Unauthorized', { status: 401 });

    const { data: row, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (error || !row) return new NextResponse('Analiz bulunamadı', { status: 404 });

    const inp = (row.inputs ?? {}) as Record<string, unknown>;
    const out = (row.outputs ?? {}) as Record<string, unknown>;

    // ─── Değerleri çıkar ───
    const salePrice = n(inp.sale_price);
    const productCost = n(inp.product_cost);
    const shippingCost = n(inp.shipping_cost);
    const packagingCost = n(inp.packaging_cost);
    const adCost = n(inp.ad_cost_per_sale);
    const otherCost = n(inp.other_cost);
    const commPct = n(inp.commission_pct);
    const vatPct = n(inp.vat_pct, 20);
    const returnPct = n(inp.return_rate_pct);
    const monthlySales = n(inp.monthly_sales_volume);
    const payoutDelay = n(inp.payout_delay_days);
    const productName = (row.product_name ?? inp.product_name ?? 'İsimsiz Ürün') as string;
    const mp = (row.marketplace ?? inp.marketplace ?? 'trendyol') as string;
    const riskScore = n(row.risk_score);
    const riskLvl = (row.risk_level ?? 'moderate') as string;
    const createdAt = row.created_at ? new Date(row.created_at as string) : new Date();

    // ─── Hesaplamalar (outputs'tan al, yoksa hesapla) ───
    const vatAmount = n(out.vat_amount) || (salePrice - salePrice / (1 + vatPct / 100));
    const salePriceExclVat = salePrice - vatAmount;
    const commission = n(out.commission_amount) || (salePriceExclVat * commPct / 100);
    const returnLoss = n(out.expected_return_loss) || (salePrice * returnPct / 100);
    const serviceFee = n(out.service_fee_amount);
    const unitVarCost = productCost + shippingCost + packagingCost + adCost + otherCost + serviceFee;
    const unitTotalCost = n(out.unit_total_cost) || (unitVarCost + commission + vatAmount + returnLoss);
    const unitNetProfit = n(out.unit_net_profit) || (salePrice - unitTotalCost);
    const marginPct = n(out.margin_pct) || (salePrice > 0 ? (unitNetProfit / salePrice) * 100 : 0);
    const monthlyRevenue = n(out.monthly_revenue) || (salePrice * monthlySales);
    const monthlyNetProfit = n(out.monthly_net_profit) || (unitNetProfit * monthlySales);
    const monthlyTotalCost = n(out.monthly_total_cost) || (unitTotalCost * monthlySales);
    const breakevenPrice = n(out.breakeven_price) || unitTotalCost;

    // Nakit akışı
    const dailyOutflow = (unitVarCost * monthlySales) / 30;
    const workingCapital = dailyOutflow * payoutDelay;

    // Reklam tavanı
    const adCeiling = unitNetProfit + adCost; // maks reklam = mevcut kar + mevcut reklam

    // ─── PDF Oluştur ───
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    let font: PDFFont;
    let fontBold: PDFFont;
    let useFallback = false;

    try {
      const [r, b] = await Promise.all([
        fetch(FONT_URLS.REGULAR).then(r => r.arrayBuffer()),
        fetch(FONT_URLS.BOLD).then(r => r.arrayBuffer()),
      ]);
      font = await pdfDoc.embedFont(r);
      fontBold = await pdfDoc.embedFont(b);
    } catch {
      useFallback = true;
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }

    const clean = (t: string) => {
      if (!useFallback) return t;
      return t.replace(/ğ/g,'g').replace(/Ğ/g,'G').replace(/ü/g,'u').replace(/Ü/g,'U')
        .replace(/ş/g,'s').replace(/Ş/g,'S').replace(/ı/g,'i').replace(/İ/g,'I')
        .replace(/ö/g,'o').replace(/Ö/g,'O').replace(/ç/g,'c').replace(/Ç/g,'C')
        .replace(/₺/g,'TL');
    };

    // ═══════════════════════════════════════
    // SAYFA 1 — Özet + Maliyet Dağılımı
    // ═══════════════════════════════════════
    const p1 = pdfDoc.addPage([595.28, 841.89]);
    const W = 595.28;
    const M = 40; // margin
    let y = 841.89 - M;

    const txt = (page: PDFPage, t: string, x: number, yy: number, size: number, opts: { font?: PDFFont; color?: ReturnType<typeof rgb> } = {}) => {
      page.drawText(clean(t), { x, y: yy, size, font: opts.font ?? font, color: opts.color ?? C.TEXT });
    };
    const txtR = (page: PDFPage, t: string, x: number, yy: number, size: number, opts: { font?: PDFFont; color?: ReturnType<typeof rgb> } = {}) => {
      const ct = clean(t);
      const w = (opts.font ?? font).widthOfTextAtSize(ct, size);
      page.drawText(ct, { x: x - w, y: yy, size, font: opts.font ?? font, color: opts.color ?? C.TEXT });
    };

    // ── HEADER ──
    // Amber gradient bar
    p1.drawRectangle({ x: 0, y: y - 5, width: W, height: 50, color: C.PRIMARY });
    txt(p1, 'KÂRNET', M + 5, y + 10, 22, { font: fontBold, color: C.WHITE });
    txtR(p1, 'ANALİZ RAPORU', W - M, y + 12, 11, { font: fontBold, color: C.WHITE });
    txtR(p1, createdAt.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }), W - M, y, 8, { color: rgb(1, 1, 1) });
    y -= 65;

    // Ürün adı ve pazaryeri
    txt(p1, productName, M, y, 18, { font: fontBold, color: C.DARK });
    y -= 18;
    txt(p1, `${marketplaceLabel[mp] ?? mp} · Komisyon: %${commPct} · KDV: %${vatPct}`, M, y, 9, { color: C.GRAY });
    y -= 5;
    p1.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: C.BORDER });

    // ── DURUM + RİSK BADGE ──
    y -= 25;
    const isProfitable = unitNetProfit > 0;

    // Durum badge
    const statusText = isProfitable ? '✓ KÂRLI' : '✗ ZARAR';
    const statusColor = isProfitable ? C.SUCCESS : C.DANGER;
    const statusBg = isProfitable ? C.SUCCESS_BG : C.DANGER_BG;
    p1.drawRectangle({ x: M, y: y - 4, width: 70, height: 20, color: statusBg });
    txt(p1, statusText, M + 8, y, 9, { font: fontBold, color: statusColor });

    // Risk badge
    const rBg = riskBg(riskLvl);
    const rCol = riskColor(riskLvl);
    const rTxt = `Risk: ${riskLabel(riskLvl)} (${riskScore}/100)`;
    p1.drawRectangle({ x: M + 80, y: y - 4, width: 130, height: 20, color: rBg });
    txt(p1, rTxt, M + 88, y, 9, { font: fontBold, color: rCol });

    // ── ANA METRİKLER — Liste formatı (tablo gibi) ──
    y -= 30;
    const contentW = W - M * 2;

    // Ozet tablo basligi
    p1.drawRectangle({ x: M, y: y - 2, width: contentW, height: 22, color: C.PRIMARY });
    txt(p1, 'OZET METRIKLER', M + 12, y + 4, 8, { font: fontBold, color: C.WHITE });
    y -= 26;

    const drawMetricRow = (label: string, value: string, positive: boolean | null = null) => {
      // Zebra
      if (y % 2 === 0) p1.drawRectangle({ x: M, y: y - 2, width: contentW, height: 22, color: C.GRAY_LIGHT });
      // Sol renk cizgisi
      const barColor = positive === true ? C.SUCCESS : positive === false ? C.DANGER : C.PRIMARY;
      p1.drawRectangle({ x: M, y: y - 2, width: 3, height: 22, color: barColor });
      // Label
      txt(p1, label, M + 14, y + 4, 9, { color: C.GRAY });
      // Value
      let valColor = C.DARK;
      if (positive === true) valColor = C.SUCCESS;
      if (positive === false) valColor = C.DANGER;
      txtR(p1, value, W - M - 12, y + 4, 11, { font: fontBold, color: valColor });
      y -= 24;
    };

    drawMetricRow('Satis Fiyati', `${fmt(salePrice)} TL`);
    drawMetricRow('Birim Net Kar', `${fmt(unitNetProfit)} TL`, unitNetProfit > 0);
    drawMetricRow('Kar Marji', fmtPct(marginPct), marginPct > 0);
    drawMetricRow('Aylik Net Kar', `${fmt(monthlyNetProfit)} TL`, monthlyNetProfit > 0);
    drawMetricRow('Aylik Ciro', `${fmt(monthlyRevenue)} TL`);
    drawMetricRow('Basabas Fiyati', `${fmt(breakevenPrice)} TL`);
    drawMetricRow('Reklam Tavani', `${fmt(Math.max(0, adCeiling))} TL`);

    y -= 15;

    // ── KÂR/ZARAR ÖZETİ (kompakt) ──
    const boxColor = isProfitable ? C.SUCCESS_BG : C.DANGER_BG;
    const textCol = isProfitable ? C.SUCCESS : C.DANGER;
    p1.drawRectangle({ x: M, y: y - 2, width: contentW, height: 24, color: boxColor });
    p1.drawRectangle({ x: M, y: y - 2, width: 3, height: 24, color: textCol });

    const statusLabel = isProfitable ? 'KARLI' : 'ZARAR';
    txt(p1, `${statusLabel}: ${fmt(unitNetProfit)} TL`, M + 14, y + 4, 10, { font: fontBold, color: textCol });
    txtR(p1, `${fmtPct(marginPct)} marj | ${fmt(monthlySales)} adet/ay | Aylik: ${fmt(monthlyNetProfit)} TL`, W - M - 12, y + 5, 8, { color: C.GRAY });

    y -= 35;

    // ── SATIŞÇI İÇİN ÖZELLİKLER ──
    txt(p1, 'Onemli Bilgiler', M, y, 11, { font: fontBold, color: C.PRIMARY });
    y -= 18;

    const drawKeyValue = (label: string, value: string, yy: number) => {
      txt(p1, label, M + 10, yy, 8, { color: C.GRAY });
      txtR(p1, value, W - M - 10, yy, 8, { font: fontBold, color: C.DARK });
      return yy - 16;
    };

    y = drawKeyValue('Urun Maliyeti', `${fmt(productCost)} TL`, y);
    y = drawKeyValue(`Komisyon (%${commPct})`, `${fmt(commission)} TL`, y);
    y = drawKeyValue(`KDV (%${vatPct})`, `${fmt(vatAmount)} TL`, y);
    y = drawKeyValue('Kargo', `${fmt(shippingCost)} TL`, y);
    if (adCost > 0) y = drawKeyValue('Reklam (Birim)', `${fmt(adCost)} TL`, y);
    if (returnLoss > 0) y = drawKeyValue(`Iade Kaybi (%${returnPct})`, `${fmt(returnLoss)} TL`, y);
    p1.drawLine({ start: { x: M, y: y + 5 }, end: { x: W - M, y: y + 5 }, thickness: 0.5, color: C.BORDER });
    y = drawKeyValue('TOPLAM MALIYET', `${fmt(unitTotalCost)} TL`, y);

    y -= 20;

    // ── NAKİT AKIŞI ──
    txt(p1, 'Nakit Akisi', M, y, 11, { font: fontBold, color: C.PRIMARY });
    y -= 18;
    y = drawKeyValue('Gunluk Nakit Cikisi', `${fmt(dailyOutflow)} TL`, y);
    y = drawKeyValue(`Isletme Sermayesi (${payoutDelay} gun)`, `${fmt(workingCapital)} TL`, y);
    y = drawKeyValue('Maks Reklam Butcesi', `${fmt(Math.max(0, adCeiling))} TL`, y);

    y -= 20;

    // ── RİSK ──
    txt(p1, 'Risk Degerlendirmesi', M, y, 11, { font: fontBold, color: C.PRIMARY });
    y -= 18;
    y = drawKeyValue('Risk Skoru', `${riskScore}/100`, y);
    y = drawKeyValue('Risk Seviyesi', riskLabel(riskLvl), y);
    const riskFactors = (out._risk_factors ?? []) as Array<{ name: string }>;
    for (const f of riskFactors.slice(0, 3)) {
      p1.drawRectangle({ x: M + 5, y: y - 2, width: W - M * 2 - 10, height: 14, color: riskBg(riskLvl) });
      txt(p1, `- ${f.name}`, M + 12, y, 7, { color: riskColor(riskLvl) });
      y -= 16;
    }

    // ── FOOTER Sayfa 1 ──
    p1.drawLine({ start: { x: M, y: 50 }, end: { x: W - M, y: 50 }, thickness: 0.5, color: C.BORDER });
    txt(p1, 'kârnet.com', M, 38, 7, { color: C.GRAY });
    txtR(p1, `Sayfa 1/2 · ${createdAt.toLocaleDateString('tr-TR')}`, W - M, 38, 7, { color: C.GRAY });
    txt(p1, 'Bu rapor tahmini hesaplamalara dayanır. Muhasebeciye danışmadan karar vermeyin.', M, 28, 6, { color: C.GRAY });

    // ═══════════════════════════════════════
    // SAYFA 2 — Maliyet Tablosu + Oneriler
    // ═══════════════════════════════════════
    const p2 = pdfDoc.addPage([595.28, 841.89]);
    y = 841.89 - M;

    // Header bar
    p2.drawRectangle({ x: 0, y: y - 5, width: W, height: 35, color: C.PRIMARY });
    txt(p2, 'KARNET - Maliyet Analizi', M + 5, y + 5, 14, { font: fontBold, color: C.WHITE });
    txtR(p2, clean(productName), W - M, y + 5, 10, { color: C.WHITE });
    y -= 55;

    const drawInfoRow = (page: PDFPage, label: string, value: string, yy: number, bold = false) => {
      txt(page, label, M + 10, yy, 9, { color: C.GRAY });
      txtR(page, value, W - M - 10, yy, 9, { font: bold ? fontBold : font, color: C.DARK });
      return yy - 18;
    };

    // ── MALİYET TABLOSU ──
    txt(p2, 'Maliyet Dagilimi (Birim)', M, y, 12, { font: fontBold, color: C.PRIMARY });
    y -= 22;

    // Tablo basligi
    p2.drawRectangle({ x: M, y: y - 2, width: W - M * 2, height: 22, color: C.PRIMARY });
    txt(p2, 'Kalem', M + 10, y + 4, 8, { font: fontBold, color: C.WHITE });
    txtR(p2, 'Tutar (TL)', W - M - 90, y + 4, 8, { font: fontBold, color: C.WHITE });
    txtR(p2, 'Oran', W - M - 10, y + 4, 8, { font: fontBold, color: C.WHITE });

    const costItems = [
      { name: 'Urun Maliyeti', val: productCost },
      { name: `Komisyon (%${commPct})`, val: commission },
      { name: `KDV (%${vatPct})`, val: vatAmount },
      { name: 'Kargo', val: shippingCost },
      { name: 'Paketleme', val: packagingCost },
      { name: 'Reklam (Birim)', val: adCost },
      { name: `Iade Kaybi (%${returnPct})`, val: returnLoss },
      { name: 'Diger Giderler', val: otherCost },
      { name: 'Servis Bedeli', val: serviceFee },
    ].filter(i => i.val > 0);

    y -= 24;
    let zebra = false;
    for (const item of costItems) {
      const pct = unitTotalCost > 0 ? (item.val / unitTotalCost) * 100 : 0;
      if (zebra) p2.drawRectangle({ x: M, y: y - 2, width: W - M * 2, height: 20, color: C.GRAY_LIGHT });
      txt(p2, item.name, M + 10, y + 3, 9);
      txtR(p2, fmt(item.val), W - M - 90, y + 3, 9, { font: fontBold });
      txtR(p2, fmtPct(pct), W - M - 10, y + 3, 9, { color: C.GRAY });
      const barW = Math.min(pct * 0.5, 50);
      p2.drawRectangle({ x: W - M - 70, y: y + 1, width: barW, height: 10, color: C.PRIMARY, opacity: 0.15 });
      y -= 22;
      zebra = !zebra;
    }

    // Toplam
    p2.drawLine({ start: { x: M, y: y + 10 }, end: { x: W - M, y: y + 10 }, thickness: 1, color: C.PRIMARY });
    y -= 5;
    p2.drawRectangle({ x: M, y: y - 4, width: W - M * 2, height: 22, color: C.GRAY_LIGHT });
    txt(p2, 'TOPLAM BIRIM MALIYET', M + 10, y + 2, 9, { font: fontBold, color: C.DARK });
    txtR(p2, `${fmt(unitTotalCost)} TL`, W - M - 90, y + 2, 9, { font: fontBold, color: C.DARK });
    txtR(p2, '%100', W - M - 10, y + 2, 9, { font: fontBold, color: C.DARK });

    y -= 35;

    // ── AYLIK PROJEKSIYON ──
    txt(p2, 'Aylik Projeksiyon', M, y, 12, { font: fontBold, color: C.PRIMARY });
    y -= 20;

    y = drawInfoRow(p2, 'Aylik Satis Adedi', `${fmt(monthlySales)} adet`, y);
    y = drawInfoRow(p2, 'Aylik Brut Ciro', `${fmt(monthlyRevenue)} TL`, y);
    y = drawInfoRow(p2, 'Aylik Toplam Maliyet', `${fmt(monthlyTotalCost)} TL`, y);
    y = drawInfoRow(p2, 'Aylik Net Kar', `${fmt(monthlyNetProfit)} TL`, y, true);
    const yearlyProfit = monthlyNetProfit * 12;
    y = drawInfoRow(p2, 'Yillik Tahmini Net Kar', `${fmt(yearlyProfit)} TL`, y, true);
    p2.drawLine({ start: { x: M, y: y + 5 }, end: { x: W - M, y: y + 5 }, thickness: 0.5, color: C.BORDER });

    y -= 25;

    // ── ÖNERİLER ──
    txt(p2, 'Oneriler', M, y, 12, { font: fontBold, color: C.PRIMARY });
    y -= 20;

    const tips: string[] = [];
    if (marginPct < 10) tips.push('Dusuk marj: Fiyat artirma veya maliyet azaltma degerlendirin.');
    if (marginPct < 0) tips.push('Urun zararda! Satisa devam etmek nakit kaybina yol acar.');
    if (returnPct >= 15) tips.push(`Iade orani yuksek (%${returnPct}). Urun kalitesi ve aciklamalari gozden gecirin.`);
    if (adCost > unitNetProfit && adCost > 0) tips.push('Reklam harcamasi kari asiyor. ROAS optimizasyonu yapin.');
    if (commPct >= 25) tips.push(`Komisyon orani yuksek (%${commPct}). Farkli pazaryeri veya kategori degerlendirin.`);
    if (monthlySales === 0) tips.push('Satis hacmi girilmemis. Aylik projeksiyonlar icin satis tahmini ekleyin.');
    if (payoutDelay > 14) tips.push(`Odeme gecikmesi ${payoutDelay} gun - nakit akisini sikilastirabilir.`);
    if (isProfitable && marginPct > 20) tips.push('Iyi marj! Reklam butcesi artirarak satis hacmini buyutebilirsiniz.');
    if (tips.length === 0) tips.push('Genel durumunuz dengeli gorunuyor. Duzenli analiz yapmaya devam edin.');

    for (const tip of tips) {
      txt(p2, `  ${tip}`, M + 10, y, 8, { color: C.TEXT });
      y -= 16;
    }

    // ── FOOTER Sayfa 2 ──
    p2.drawLine({ start: { x: M, y: 50 }, end: { x: W - M, y: 50 }, thickness: 0.5, color: C.BORDER });
    txt(p2, 'karnet.com', M, 38, 7, { color: C.GRAY });
    txtR(p2, `Sayfa 2/2`, W - M, 38, 7, { color: C.GRAY });
    txt(p2, 'Bu rapor tahmini hesaplamalara dayanir. Muhasebeciye danismadan karar vermeyin.', M, 28, 6, { color: C.GRAY });

    // ─── Kaydet ───
    const pdfBytes = await pdfDoc.save();
    const safeName = productName
      .replace(/ğ/g,'g').replace(/Ğ/g,'G').replace(/ü/g,'u').replace(/Ü/g,'U')
      .replace(/ş/g,'s').replace(/Ş/g,'S').replace(/ı/g,'i').replace(/İ/g,'I')
      .replace(/ö/g,'o').replace(/Ö/g,'O').replace(/ç/g,'c').replace(/Ç/g,'C')
      .replace(/â/g,'a').replace(/Â/g,'A')
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .trim().slice(0, 50);
    const filename = `Karnet_Rapor_${safeName}_${createdAt.toISOString().split('T')[0]}.pdf`;

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    // Geçici debug — production'dan önce kaldırılacak
    const msg = error instanceof Error ? error.message + '\n' + error.stack : 'Bilinmeyen hata';
    return new NextResponse('PDF oluşturulamadı: ' + msg, { status: 500 });
  }
}
