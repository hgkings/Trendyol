'use client';

import Link from 'next/link';
import { Analysis } from '@/types';
import { getMarketplaceLabel } from '@/lib/marketplace-data';
import { formatCurrency, formatPercent } from '@/components/shared/format';
import { RiskBadge } from '@/components/shared/risk-badge';
import { Button } from '@/components/ui/button';
import { Eye, Trash2, Pencil } from 'lucide-react';

interface ProductsTableProps {
  analyses: Analysis[];
  onDelete?: (id: string) => void;
}

export function ProductsTable({ analyses, onDelete }: ProductsTableProps) {
  if (analyses.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-12 text-center">
        <p className="text-muted-foreground">Henuz analiz yapilmamis.</p>
        <Link href="/analysis/new">
          <Button className="mt-4">Ilk Analizini Yap</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Urun</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">Pazaryeri</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Birim Kar</th>
              <th className="hidden px-4 py-3 text-right font-medium text-muted-foreground md:table-cell">Marj</th>
              <th className="hidden px-4 py-3 text-right font-medium text-muted-foreground lg:table-cell">Aylik Kar</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Risk</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Islem</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {analyses.map((a) => (
              <tr key={a.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="font-medium">{a.input.product_name}</div>
                  <div className="text-xs text-muted-foreground sm:hidden">
                    {getMarketplaceLabel(a.input.marketplace)}
                  </div>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                    {getMarketplaceLabel(a.input.marketplace)}
                  </span>
                </td>
                <td className={`px-4 py-3 text-right font-medium ${a.result.unit_net_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(a.result.unit_net_profit)}
                </td>
                <td className={`hidden px-4 py-3 text-right font-medium md:table-cell ${a.result.margin_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatPercent(a.result.margin_pct)}
                </td>
                <td className={`hidden px-4 py-3 text-right font-medium lg:table-cell ${a.result.monthly_net_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(a.result.monthly_net_profit)}
                </td>
                <td className="px-4 py-3 text-center">
                  <RiskBadge level={a.risk.level} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/analysis/${a.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Goruntule">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`/analysis/${a.id}/edit`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700" title="Duzenle">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        onClick={() => onDelete(a.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
