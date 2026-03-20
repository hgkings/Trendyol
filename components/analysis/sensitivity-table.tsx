'use client';

import { ProductInput } from '@/types';
import { generateSensitivityAnalysis } from '@/utils/calculations';
import { formatCurrency } from '@/components/shared/format';

interface SensitivityTableProps {
  input: ProductInput;
}

export function SensitivityTable({ input }: SensitivityTableProps) {
  const rows = generateSensitivityAnalysis(input);

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-6">
      <h3 className="text-sm font-semibold">Hassasiyet Analizi</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Farkli senaryolarda karinizin nasil degisecegini gorun.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/20">
              <th className="pb-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Senaryo</th>
              <th className="pb-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Yeni aylık kâr</th>
              <th className="pb-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Fark</th>
              <th className="pb-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Değişim</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {rows.map((row) => (
              <tr key={row.scenario} className="transition-colors hover:bg-muted/30">
                <td className="py-2.5 font-medium">{row.scenario}</td>
                <td className={`py-2.5 text-right font-medium ${row.newProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(row.newProfit)}
                </td>
                <td className={`py-2.5 text-right ${row.difference >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {row.difference >= 0 ? '+' : ''}{formatCurrency(row.difference)}
                </td>
                <td className={`py-2.5 text-right ${row.percentChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {row.percentChange >= 0 ? '+' : ''}{row.percentChange.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
