export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  if (!Number.isFinite(num)) return '0,00 ₺';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '%0,0';
  return `%${value.toFixed(1)}`;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('tr-TR').format(value);
}
