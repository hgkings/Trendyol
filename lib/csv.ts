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

export function analysesToCSV(analyses: { input: ProductInput; result: { unit_net_profit: number; margin_pct: number; monthly_net_profit: number }; risk: { level: string } }[]): string {
  const headers = [
    'Pazaryeri', 'Ürün', 'Aylık Satış', 'Maliyet', 'Satış Fiyatı',
    'Komisyon %', 'Kargo', 'Paketleme', 'Reklam', 'İade %', 'KDV %',
    'Birim Kâr', 'Marj %', 'Aylık Kâr', 'Risk',
  ];

  const rows = analyses.map((a) => [
    a.input.marketplace,
    a.input.product_name,
    a.input.monthly_sales_volume,
    a.input.product_cost,
    a.input.sale_price,
    a.input.commission_pct,
    a.input.shipping_cost,
    a.input.packaging_cost,
    a.input.ad_cost_per_sale,
    a.input.return_rate_pct,
    a.input.vat_pct,
    a.result.unit_net_profit.toFixed(2),
    a.result.margin_pct.toFixed(1),
    a.result.monthly_net_profit.toFixed(2),
    a.risk.level,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function analysesToJSON(analyses: unknown[]): string {
  return JSON.stringify(analyses, null, 2);
}
