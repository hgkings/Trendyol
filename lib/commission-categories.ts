import { Marketplace } from '@/types';

export interface CommissionCategory {
  label: string;
  commission_pct: number;
}

// Alias for backward compatibility
export type TrendyolCategory = CommissionCategory;

export const MARKETPLACE_CATEGORIES: Record<Marketplace, CommissionCategory[]> = {
  trendyol: [
    { label: 'Giyim & Moda', commission_pct: 20 },
    { label: 'Ayakkabı & Çanta', commission_pct: 20 },
    { label: 'Spor & Outdoor', commission_pct: 18 },
    { label: 'Kozmetik & Kişisel Bakım', commission_pct: 14 },
    { label: 'Ev & Yaşam', commission_pct: 14 },
    { label: 'Mobilya', commission_pct: 13 },
    { label: 'Anne & Bebek', commission_pct: 13 },
    { label: 'Oyuncak', commission_pct: 13 },
    { label: 'Otomotiv', commission_pct: 10 },
    { label: 'Elektronik', commission_pct: 8 },
    { label: 'Telefon & Aksesuar', commission_pct: 8 },
    { label: 'Bilgisayar & Tablet', commission_pct: 8 },
    { label: 'Kitap & Kırtasiye', commission_pct: 8 },
    { label: 'Süpermarket & Gıda', commission_pct: 5 },
    { label: 'Diğer', commission_pct: 14 },
  ],
  hepsiburada: [
    { label: 'Giyim & Moda', commission_pct: 18 },
    { label: 'Ayakkabı', commission_pct: 18 },
    { label: 'Kozmetik', commission_pct: 15 },
    { label: 'Ev & Yaşam', commission_pct: 15 },
    { label: 'Spor & Outdoor', commission_pct: 15 },
    { label: 'Anne & Bebek', commission_pct: 14 },
    { label: 'Oyuncak', commission_pct: 14 },
    { label: 'Elektronik', commission_pct: 9 },
    { label: 'Telefon & Aksesuar', commission_pct: 9 },
    { label: 'Bilgisayar', commission_pct: 8 },
    { label: 'Kitap', commission_pct: 8 },
    { label: 'Süpermarket', commission_pct: 8 },
    { label: 'Diğer', commission_pct: 13 },
  ],
  n11: [
    { label: 'Giyim & Moda', commission_pct: 16 },
    { label: 'Ayakkabı', commission_pct: 16 },
    { label: 'Kozmetik', commission_pct: 14 },
    { label: 'Ev & Yaşam', commission_pct: 14 },
    { label: 'Spor & Outdoor', commission_pct: 14 },
    { label: 'Anne & Bebek', commission_pct: 13 },
    { label: 'Oyuncak', commission_pct: 13 },
    { label: 'Elektronik', commission_pct: 8 },
    { label: 'Telefon & Aksesuar', commission_pct: 8 },
    { label: 'Kitap', commission_pct: 8 },
    { label: 'Diğer', commission_pct: 12 },
  ],
  amazon_tr: [
    { label: 'Giyim & Moda', commission_pct: 15 },
    { label: 'Ayakkabı', commission_pct: 15 },
    { label: 'Kozmetik', commission_pct: 15 },
    { label: 'Ev & Yaşam', commission_pct: 15 },
    { label: 'Spor & Outdoor', commission_pct: 15 },
    { label: 'Anne & Bebek', commission_pct: 15 },
    { label: 'Oyuncak', commission_pct: 15 },
    { label: 'Elektronik', commission_pct: 8 },
    { label: 'Telefon & Aksesuar', commission_pct: 8 },
    { label: 'Bilgisayar & Tablet', commission_pct: 7 },
    { label: 'Kitap', commission_pct: 15 },
    { label: 'Diğer', commission_pct: 15 },
  ],
  custom: [
    { label: 'Diğer', commission_pct: 15 },
  ],
};

export const N11_EXTRA_FEE_PCT = 1.87;
export const N11_MARKETING_FEE_PCT = 1.20;
export const N11_MARKETPLACE_FEE_PCT = 0.67;

export function getMarketplaceCategories(marketplace: Marketplace): CommissionCategory[] {
  return MARKETPLACE_CATEGORIES[marketplace] ?? MARKETPLACE_CATEGORIES.custom;
}

export function getCategoryCommission(marketplace: Marketplace, label: string): number | undefined {
  return MARKETPLACE_CATEGORIES[marketplace]?.find((c) => c.label === label)?.commission_pct;
}

// Backward compat exports
export const trendyolCategories = MARKETPLACE_CATEGORIES.trendyol;
export function getTrendyolCategoryCommission(label: string): number | undefined {
  return getCategoryCommission('trendyol', label);
}
