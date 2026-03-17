export interface TrendyolCategory {
  label: string;
  commission_pct: number;
}

export const trendyolCategories: TrendyolCategory[] = [
  { label: 'Elektronik', commission_pct: 8 },
  { label: 'Bilgisayar & Tablet', commission_pct: 8 },
  { label: 'Telefon & Aksesuar', commission_pct: 8 },
  { label: 'Ev & Yaşam', commission_pct: 13 },
  { label: 'Mobilya', commission_pct: 12 },
  { label: 'Spor & Outdoor', commission_pct: 14 },
  { label: 'Giyim & Moda (Kadın)', commission_pct: 15 },
  { label: 'Giyim & Moda (Erkek)', commission_pct: 15 },
  { label: 'Ayakkabı', commission_pct: 15 },
  { label: 'Çanta & Aksesuar', commission_pct: 15 },
  { label: 'Anne & Bebek', commission_pct: 13 },
  { label: 'Oyuncak', commission_pct: 13 },
  { label: 'Kitap & Müzik', commission_pct: 8 },
  { label: 'Kozmetik & Kişisel Bakım', commission_pct: 12 },
  { label: 'Süpermarket', commission_pct: 8 },
  { label: 'Pet Shop', commission_pct: 10 },
  { label: 'Diğer', commission_pct: 12 },
];

export function getTrendyolCategoryCommission(label: string): number | undefined {
  return trendyolCategories.find((c) => c.label === label)?.commission_pct;
}
