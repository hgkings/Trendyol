import { ProductInput, Marketplace } from '@/types';

const EXPECTED_COLUMNS = [
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

export const CSV_TEMPLATE = `marketplace,product_name,monthly_sales_volume,product_cost,sale_price,commission_pct,shipping_cost,packaging_cost,ad_cost,return_rate,vat_pct
trendyol,Ornek Urun 1,100,120,249,18,25,5,10,8,20
hepsiburada,Ornek Urun 2,60,200,399,20,30,6,15,10,20
amazon_tr,Ornek Urun 4,80,180,449,17,28,5,12,6,20`;

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

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  for (const col of EXPECTED_COLUMNS) {
    if (!headers.includes(col)) {
      missingColumns.push(col);
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

    const rawMp = row.marketplace?.toLowerCase().trim() || '';
    const marketplace = MARKETPLACE_MAP[rawMp];

    if (!marketplace) {
      errors.push(`Satır ${i + 1}: Geçersiz pazaryeri "${row.marketplace}". Kabul edilenler: trendyol, hepsiburada, n11, amazon_tr, custom`);
      continue;
    }

    const input: ProductInput = {
      marketplace,
      product_name: row.product_name || `Ürün ${i}`,
      monthly_sales_volume: parseFloat(row.monthly_sales_volume) || 0,
      product_cost: parseFloat(row.product_cost) || 0,
      sale_price: parseFloat(row.sale_price) || 0,
      commission_pct: parseFloat(row.commission_pct) || 0,
      shipping_cost: parseFloat(row.shipping_cost) || 0,
      packaging_cost: parseFloat(row.packaging_cost) || 0,
      ad_cost_per_sale: parseFloat(row.ad_cost) || 0,
      return_rate_pct: parseFloat(row.return_rate) || 0,
      vat_pct: parseFloat(row.vat_pct) || 20,
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
  // Binlik ayrac (nokta)
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

export function analysesToCSV(analyses: AnalysisForExport[]): string {
  const headers = [
    // Temel Bilgiler
    'Urun Adi',
    'Pazaryeri',
    'Tarih',
    // Fiyat & Satis
    'Satis Fiyati (TL)',
    'Satis Fiyati KDV Haric (TL)',
    'Aylik Satis Adedi',
    // Maliyetler
    'Urun Maliyeti (TL)',
    'Kargo (TL)',
    'Paketleme (TL)',
    'Reklam Birim (TL)',
    'Diger Gider (TL)',
    // Oranlar
    'Komisyon %',
    'KDV %',
    'Iade %',
    // Hesaplanan Kesintiler
    'Komisyon Tutari (TL)',
    'KDV Tutari (TL)',
    'Iade Kaybi (TL)',
    'Servis Bedeli (TL)',
    // Toplam Maliyet
    'Degisken Maliyet (TL)',
    'Toplam Birim Maliyet (TL)',
    // Kar Metrikleri
    'Birim Net Kar (TL)',
    'Kar Marji %',
    'Basabas Fiyati (TL)',
    // Aylik Projeksiyon
    'Aylik Ciro (TL)',
    'Aylik Toplam Maliyet (TL)',
    'Aylik Net Kar (TL)',
    'Yillik Tahmini Kar (TL)',
    // Risk
    'Risk Skoru',
    'Risk Seviyesi',
    // Durum
    'Durum',
  ];

  const rows = analyses.map((a) => {
    const inp = a.input;
    const res = a.result;
    const monthlyProfit = num(res.monthly_net_profit);
    const unitProfit = num(res.unit_net_profit);

    return [
      csvSafe(inp.product_name || 'Isimsiz'),
      inp.marketplace || 'trendyol',
      a.createdAt ? new Date(a.createdAt).toLocaleDateString('tr-TR') : '',
      fmtNum(num(inp.sale_price)),
      fmtNum(num(res.sale_price_excl_vat)),
      fmtNum(num(inp.monthly_sales_volume), 0),
      fmtNum(num(inp.product_cost)),
      fmtNum(num(inp.shipping_cost)),
      fmtNum(num(inp.packaging_cost)),
      fmtNum(num(inp.ad_cost_per_sale)),
      fmtNum(num(inp.other_cost)),
      fmtNum(num(inp.commission_pct), 0),
      fmtNum(num(inp.vat_pct), 0),
      fmtNum(num(inp.return_rate_pct), 0),
      fmtNum(num(res.commission_amount)),
      fmtNum(num(res.vat_amount)),
      fmtNum(num(res.expected_return_loss)),
      fmtNum(num(res.service_fee_amount)),
      fmtNum(num(res.unit_variable_cost)),
      fmtNum(num(res.unit_total_cost)),
      fmtNum(unitProfit),
      fmtNum(num(res.margin_pct), 1),
      fmtNum(num(res.breakeven_price)),
      fmtNum(num(res.monthly_revenue)),
      fmtNum(num(res.monthly_total_cost)),
      fmtNum(monthlyProfit),
      fmtNum(monthlyProfit * 12),
      fmtNum(num(a.risk.score), 0),
      RISK_TR[a.risk.level] || a.risk.level,
      unitProfit > 0 ? 'Karli' : unitProfit === 0 ? 'Basabas' : 'Zarar',
    ];
  });

  // BOM ekle — Excel Turkce karakterleri dogru gostersin
  const bom = '\uFEFF';
  return bom + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

export function analysesToJSON(analyses: unknown[]): string {
  return JSON.stringify(analyses, null, 2);
}
