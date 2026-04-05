import { ProductInput, Marketplace } from '@/types';

// Yeni Türkçe başlıklar
const TURKISH_COLUMNS = [
  'pazaryeri',
  'urun_adi',
  'aylik_satis_adedi',
  'urun_maliyeti',
  'satis_fiyati',
  'komisyon_orani',
  'kargo_ucreti',
  'paketleme_maliyeti',
  'reklam_maliyeti',
  'iade_orani',
  'kdv_orani',
];

// Eski İngilizce başlıklar (geriye dönük uyumluluk)
const ENGLISH_COLUMNS = [
  'marketplace',
  'product_name',
  'monthly_sales_volume',
  'product_cost',
  'sale_price',
  'commission_pct',
  'shipping_cost',
  'packaging_cost',
  'ad_cost',
  'return_rate',
  'vat_pct',
];

// Eski → Yeni başlık eşlemesi (backward compatibility)
const HEADER_ALIASES: Record<string, string> = {
  // İngilizce → Türkçe
  'marketplace': 'pazaryeri',
  'product_name': 'urun_adi',
  'monthly_sales_volume': 'aylik_satis_adedi',
  'product_cost': 'urun_maliyeti',
  'sale_price': 'satis_fiyati',
  'commission_pct': 'komisyon_orani',
  'shipping_cost': 'kargo_ucreti',
  'packaging_cost': 'paketleme_maliyeti',
  'ad_cost': 'reklam_maliyeti',
  'return_rate': 'iade_orani',
  'vat_pct': 'kdv_orani',
  // Türkçe → Türkçe (zaten doğru)
  'pazaryeri': 'pazaryeri',
  'urun_adi': 'urun_adi',
  'aylik_satis_adedi': 'aylik_satis_adedi',
  'urun_maliyeti': 'urun_maliyeti',
  'satis_fiyati': 'satis_fiyati',
  'komisyon_orani': 'komisyon_orani',
  'kargo_ucreti': 'kargo_ucreti',
  'paketleme_maliyeti': 'paketleme_maliyeti',
  'reklam_maliyeti': 'reklam_maliyeti',
  'iade_orani': 'iade_orani',
  'kdv_orani': 'kdv_orani',
};

export const CSV_TEMPLATE = `pazaryeri,urun_adi,aylik_satis_adedi,urun_maliyeti,satis_fiyati,komisyon_orani,kargo_ucreti,paketleme_maliyeti,reklam_maliyeti,iade_orani,kdv_orani
trendyol,Samsung Galaxy A15 Kilif,150,35,129,18,15,4,8,12,20
trendyol,Nike Spor Ayakkabi 42 Numara,45,280,599,20,25,8,15,25,20
hepsiburada,Philips Airfryer Yag Filtresi,80,42,149,20,18,3,10,8,20
n11,Bluetooth Kulaklik TWS,200,65,199,16,12,5,12,10,20
amazon_tr,Organik Hindistan Cevizi Yagi 500ml,120,38,119,17,20,6,7,6,20`;

const MARKETPLACE_MAP: Record<string, Marketplace> = {
  'trendyol': 'trendyol',
  'hepsiburada': 'hepsiburada',
  'n11': 'n11',
  'amazon_tr': 'amazon_tr',
  'amazon tr': 'amazon_tr',
  'amazontr': 'amazon_tr',
  'amazon': 'amazon_tr',
  'custom': 'custom',
  'ozel': 'custom',
  'özel': 'custom',
};

export function parseCSV(text: string): { data: ProductInput[]; errors: string[]; missingColumns: string[] } {
  const errors: string[] = [];
  const missingColumns: string[] = [];
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);

  if (lines.length < 2) {
    return { data: [], errors: ['CSV dosyası en az bir başlık ve bir veri satırı içermelidir.'], missingColumns: [] };
  }

  // Dosya boyutu ve satir limiti
  const MAX_ROWS = 500;
  const MAX_TEXT_SIZE = 5 * 1024 * 1024;
  if (text.length > MAX_TEXT_SIZE) {
    return { data: [], errors: ['CSV dosyası çok büyük (maks. 5 MB).'], missingColumns: [] };
  }
  if (lines.length - 1 > MAX_ROWS) {
    return { data: [], errors: [`CSV dosyası en fazla ${MAX_ROWS} satır içerebilir (${lines.length - 1} satır bulundu).`], missingColumns: [] };
  }

  // Başlıkları normalize et — hem TR hem EN kabul eder
  const rawHeaders = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const headers = rawHeaders.map(h => HEADER_ALIASES[h] ?? h);

  // Türkçe başlıkların varlığını kontrol et
  for (const col of TURKISH_COLUMNS) {
    if (!headers.includes(col)) {
      // Eski İngilizce başlık da kabul et
      const englishIdx = ENGLISH_COLUMNS.findIndex(
        eng => HEADER_ALIASES[eng] === col
      );
      const englishName = englishIdx >= 0 ? ENGLISH_COLUMNS[englishIdx] : col;
      if (!rawHeaders.includes(englishName)) {
        missingColumns.push(col);
      }
    }
  }

  if (missingColumns.length > 0) {
    return {
      data: [],
      errors: missingColumns.map(col => `Eksik sütun: ${col}`),
      missingColumns
    };
  }

  const data: ProductInput[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    if (values.length !== headers.length) {
      errors.push(`Satır ${i + 1}: Sütun sayısı uyuşmuyor (${headers.length} beklenirken ${values.length} bulundu).`);
      continue;
    }

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx];
    });

    const rawMp = row.pazaryeri?.toLowerCase().trim() || '';
    const marketplace = MARKETPLACE_MAP[rawMp];

    if (!marketplace) {
      errors.push(`Satır ${i + 1}: Geçersiz pazaryeri "${row.pazaryeri}". Kabul edilenler: trendyol, hepsiburada, n11, amazon_tr, custom`);
      continue;
    }

    const input: ProductInput = {
      marketplace,
      product_name: row.urun_adi || `Ürün ${i}`,
      monthly_sales_volume: parseFloat(row.aylik_satis_adedi) || 0,
      product_cost: parseFloat(row.urun_maliyeti) || 0,
      sale_price: parseFloat(row.satis_fiyati) || 0,
      commission_pct: parseFloat(row.komisyon_orani) || 0,
      shipping_cost: parseFloat(row.kargo_ucreti) || 0,
      packaging_cost: parseFloat(row.paketleme_maliyeti) || 0,
      ad_cost_per_sale: parseFloat(row.reklam_maliyeti) || 0,
      return_rate_pct: parseFloat(row.iade_orani) || 0,
      vat_pct: parseFloat(row.kdv_orani) || 20,
      other_cost: 0,
      payout_delay_days: 14,
    };

    data.push(input);
  }

  return { data, errors, missingColumns };
}

interface AnalysisForExport {
  input: ProductInput;
  result: {
    unit_net_profit: number;
    margin_pct: number;
    monthly_net_profit: number;
    monthly_revenue: number;
    commission_amount: number;
    vat_amount: number;
    expected_return_loss: number;
    unit_total_cost: number;
    unit_variable_cost: number;
    breakeven_price: number;
    sale_price_excl_vat: number;
    service_fee_amount: number;
    monthly_total_cost: number;
  };
  risk: { level: string; score: number };
  createdAt?: string;
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
}

// Turk Excel formatinda sayi: 1.234,56
function fmtNum(v: number, decimals = 2): string {
  const parts = v.toFixed(decimals).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (decimals === 0) return intPart;
  return `${intPart},${parts[1]}`;
}

function csvSafe(val: string | number): string {
  const s = String(val);
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const RISK_TR: Record<string, string> = {
  safe: 'Dusuk', moderate: 'Orta', risky: 'Yuksek', dangerous: 'Kritik',
};

/**
 * XLSX export — sadeleştirilmiş 13 sütun, bold başlık, auto-width.
 * Döndürür: ArrayBuffer (Blob oluşturmak için).
 */
export function analysesToXLSX(analyses: AnalysisForExport[]): ArrayBuffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx');

  const headers = [
    'Urun Adi',
    'Pazaryeri',
    'Satis Fiyati (TL)',
    'Urun Maliyeti (TL)',
    'Kargo (TL)',
    'Paketleme (TL)',
    'Reklam (TL)',
    'Komisyon %',
    'KDV %',
    'Iade %',
    'Birim Net Kar (TL)',
    'Kar Marji %',
    'Aylik Net Kar (TL)',
  ];

  const MARKETPLACE_LABELS: Record<string, string> = {
    trendyol: 'Trendyol',
    hepsiburada: 'Hepsiburada',
    n11: 'n11',
    amazon_tr: 'Amazon TR',
    custom: 'Ozel',
  };

  const rows = analyses.map((a) => {
    const inp = a.input;
    const res = a.result;
    return [
      inp.product_name || 'Isimsiz',
      MARKETPLACE_LABELS[inp.marketplace] || inp.marketplace,
      num(inp.sale_price),
      num(inp.product_cost),
      num(inp.shipping_cost),
      num(inp.packaging_cost),
      num(inp.ad_cost_per_sale),
      num(inp.commission_pct),
      num(inp.vat_pct),
      num(inp.return_rate_pct),
      num(res.unit_net_profit),
      num(res.margin_pct),
      num(res.monthly_net_profit),
    ];
  });

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-size sütun genişlikleri
  const colWidths = headers.map((h, colIdx) => {
    let maxLen = h.length;
    for (const row of rows) {
      const cellLen = String(row[colIdx] ?? '').length;
      if (cellLen > maxLen) maxLen = cellLen;
    }
    return { wch: Math.min(maxLen + 4, 40) };
  });
  ws['!cols'] = colWidths;

  // Sayısal sütunlar için Türkçe para formatı (3-6: TL, 7-9: %, 10-12: TL/%)
  const TL_FORMAT = '#,##0.00 "TL"';
  const PCT_FORMAT = '#,##0.0"%"';
  for (let r = 1; r <= rows.length; r++) {
    for (let c = 0; c < headers.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) continue;

      if (c >= 2 && c <= 6) {
        // TL sütunları
        ws[cellRef].z = TL_FORMAT;
      } else if (c >= 7 && c <= 9) {
        // Yüzde sütunları
        ws[cellRef].z = PCT_FORMAT;
      } else if (c === 10 || c === 12) {
        // Birim Net Kar, Aylık Net Kar
        ws[cellRef].z = TL_FORMAT;
      } else if (c === 11) {
        // Kar Marjı %
        ws[cellRef].z = PCT_FORMAT;
      }
    }
  }

  // Başlık satırı bold + açık gri arka plan
  for (let c = 0; c < headers.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'F3F4F6' } },
      alignment: { horizontal: 'center' },
    };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Urunler');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

/** CSV export (geriye dönük uyumluluk) */
export function analysesToCSV(analyses: AnalysisForExport[]): string {
  const headers = [
    'Urun Adi', 'Pazaryeri',
    'Satis Fiyati (TL)', 'Urun Maliyeti (TL)', 'Kargo (TL)', 'Paketleme (TL)', 'Reklam (TL)',
    'Komisyon %', 'KDV %', 'Iade %',
    'Birim Net Kar (TL)', 'Kar Marji %', 'Aylik Net Kar (TL)',
  ];

  const rows = analyses.map((a) => {
    const inp = a.input;
    const res = a.result;
    return [
      csvSafe(inp.product_name || 'Isimsiz'),
      inp.marketplace || 'trendyol',
      fmtNum(num(inp.sale_price)),
      fmtNum(num(inp.product_cost)),
      fmtNum(num(inp.shipping_cost)),
      fmtNum(num(inp.packaging_cost)),
      fmtNum(num(inp.ad_cost_per_sale)),
      fmtNum(num(inp.commission_pct), 0),
      fmtNum(num(inp.vat_pct), 0),
      fmtNum(num(inp.return_rate_pct), 0),
      fmtNum(num(res.unit_net_profit)),
      fmtNum(num(res.margin_pct), 1),
      fmtNum(num(res.monthly_net_profit)),
    ];
  });

  const bom = '\uFEFF';
  return bom + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

export function analysesToJSON(analyses: unknown[]): string {
  return JSON.stringify(analyses, null, 2);
}

// ─── Aşama 1: Maliyet Güncelleme Şablonu ───────────────────────

interface AnalysisWithId extends AnalysisForExport {
  id: string;
}

/**
 * Mevcut ürünlerin düzenlenebilir maliyet şablonunu Excel olarak export eder.
 * id kolonu dahil — geri yüklendiğinde eşleşme için kullanılır.
 */
export function exportCostTemplate(analyses: AnalysisWithId[]): ArrayBuffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx');

  const headers = [
    'ID',
    'Urun Adi',
    'Pazaryeri',
    'Aylik Satis Adedi',
    'Satis Fiyati',
    'Urun Maliyeti',
    'Kargo',
    'Paketleme',
    'Reklam',
    'Komisyon %',
    'Iade %',
    'KDV %',
    'Diger Giderler',
  ];

  const MP: Record<string, string> = {
    trendyol: 'Trendyol', hepsiburada: 'Hepsiburada',
    n11: 'n11', amazon_tr: 'Amazon TR', custom: 'Ozel',
  };

  const rows = analyses.map(a => {
    const inp = a.input;
    return [
      a.id,
      inp.product_name || '',
      MP[inp.marketplace] || inp.marketplace,
      num(inp.monthly_sales_volume),
      num(inp.sale_price),
      num(inp.product_cost),
      num(inp.shipping_cost),
      num(inp.packaging_cost),
      num(inp.ad_cost_per_sale),
      num(inp.commission_pct),
      num(inp.return_rate_pct),
      num(inp.vat_pct),
      num(inp.other_cost),
    ];
  });

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-width
  const colWidths = headers.map((h, ci) => {
    let max = h.length;
    for (const row of rows) { const l = String(row[ci] ?? '').length; if (l > max) max = l; }
    return { wch: Math.min(max + 4, 40) };
  });
  ws['!cols'] = colWidths;

  // ID kolonu gri arka plan (düzenleme)
  for (let r = 1; r <= rows.length; r++) {
    const cellRef = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[cellRef]) {
      ws[cellRef].s = { font: { color: { rgb: '999999' } }, fill: { fgColor: { rgb: 'F3F4F6' } } };
    }
  }

  // Başlık bold
  for (let c = 0; c < headers.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[cellRef]) {
      ws[cellRef].s = { font: { bold: true }, fill: { fgColor: { rgb: 'FEF3C7' } }, alignment: { horizontal: 'center' } };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Maliyet Sablonu');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

/**
 * Maliyet şablonundan geri yükleme — Excel parse edip id ile eşleştirir.
 * Döndürür: { id, updates } dizisi.
 */
export function parseCostTemplate(file: ArrayBuffer): Array<{
  id: string;
  isNew: boolean;
  updates: Partial<ProductInput> & { product_name?: string };
}> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx');
  const wb = XLSX.read(file, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  if (rows.length < 2) return [];

  const results: Array<{ id: string; isNew: boolean; updates: Partial<ProductInput> & { product_name?: string } }> = [];

  const MP_REVERSE: Record<string, Marketplace> = {
    'trendyol': 'trendyol', 'hepsiburada': 'hepsiburada',
    'n11': 'n11', 'amazon tr': 'amazon_tr', 'ozel': 'custom',
  };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const id = String(row[0] ?? '').trim();
    const productName = String(row[1] ?? '').trim();
    const mp = String(row[2] ?? '').toLowerCase().trim();

    // Boş satır atla — ne ID ne de ürün adı var
    if (!id && !productName) continue;

    results.push({
      id,
      isNew: !id,
      updates: {
        product_name: productName || undefined,
        marketplace: MP_REVERSE[mp] ?? 'trendyol',
        monthly_sales_volume: num(row[3]),
        sale_price: num(row[4]),
        product_cost: num(row[5]),
        shipping_cost: num(row[6]),
        packaging_cost: num(row[7]),
        ad_cost_per_sale: num(row[8]),
        commission_pct: num(row[9]),
        return_rate_pct: num(row[10]),
        vat_pct: num(row[11]),
        other_cost: num(row[12]),
      },
    });
  }

  return results;
}

// ─── Aşama 2: Boş Yeni Ürün Şablonu ────────────────────────────

/**
 * Boş şablon — yeni ürün ekleme için.
 * parseCSV ile uyumlu başlıklar kullanır.
 */
export function exportBlankTemplate(): ArrayBuffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx');

  // Maliyet şablonuyla AYNI başlıklar — ID boş bırakılır (yeni ürün)
  const headers = [
    'ID',
    'Urun Adi',
    'Pazaryeri',
    'Aylik Satis Adedi',
    'Satis Fiyati',
    'Urun Maliyeti',
    'Kargo',
    'Paketleme',
    'Reklam',
    'Komisyon %',
    'Iade %',
    'KDV %',
    'Diger Giderler',
  ];

  // 2 örnek satır (ID boş — yeni ürün olarak eklenir)
  const examples = [
    ['', 'Ornek Urun 1', 'Trendyol', 100, 150, 50, 10, 3, 5, 18, 12, 20, 0],
    ['', 'Ornek Urun 2', 'Hepsiburada', 50, 200, 80, 12, 4, 8, 15, 10, 20, 0],
    ['', '', '', '', '', '', '', '', '', '', '', '', ''],
  ];

  const wsData = [headers, ...examples];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = headers.map(h => ({ wch: Math.max(h.length + 4, 18) }));
  ws['!cols'] = colWidths;

  // Başlık bold + sarı
  for (let c = 0; c < headers.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[cellRef]) {
      ws[cellRef].s = { font: { bold: true }, fill: { fgColor: { rgb: 'FEF3C7' } }, alignment: { horizontal: 'center' } };
    }
  }

  // Örnek satırlar gri
  for (let r = 1; r <= 2; r++) {
    for (let c = 0; c < headers.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (ws[cellRef]) {
        ws[cellRef].s = { font: { color: { rgb: '9CA3AF' }, italic: true } };
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Yeni Urun Sablonu');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}
