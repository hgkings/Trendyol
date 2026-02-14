
import { MarketplaceDefaults, Marketplace } from '@/types';

export const marketplaces: MarketplaceDefaults[] = [
  {
    key: 'trendyol',
    label: 'Trendyol',
    commission_pct: 18,
    return_rate_pct: 8,
    vat_pct: 20,
    payout_delay_days: 28
  },
  {
    key: 'hepsiburada',
    label: 'Hepsiburada',
    commission_pct: 20,
    return_rate_pct: 10,
    vat_pct: 20,
    payout_delay_days: 30
  },
  {
    key: 'n11',
    label: 'n11',
    commission_pct: 16,
    return_rate_pct: 7,
    vat_pct: 20,
    payout_delay_days: 21
  },
  {
    key: 'amazon_tr',
    label: 'Amazon TR',
    commission_pct: 17,
    return_rate_pct: 6,
    vat_pct: 20,
    payout_delay_days: 14
  },
  {
    key: 'custom',
    label: 'Ozel Pazaryeri',
    commission_pct: 15,
    return_rate_pct: 5,
    vat_pct: 20,
    payout_delay_days: 30
  },
];

export function getMarketplaceDefaults(key: Marketplace): MarketplaceDefaults {
  return marketplaces.find((m) => m.key === key) || marketplaces[4];
}

export function getMarketplaceLabel(key: Marketplace): string {
  return marketplaces.find((m) => m.key === key)?.label || key;
}
