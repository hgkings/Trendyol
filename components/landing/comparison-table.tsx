'use client';

import { Check, X, Crown } from 'lucide-react';

const rows = [
  { label: 'Gerçek net kâr',       karnet: 'yes',     excel: 'no',  rakip: 'partial' },
  { label: 'KDV ayrıştırma',       karnet: 'pro',     excel: 'no',  rakip: 'no'      },
  { label: 'İade maliyet analizi', karnet: 'yes',     excel: 'no',  rakip: 'no'      },
  { label: '4 pazaryeri desteği',  karnet: 'yes',     excel: 'no',  rakip: 'partial' },
  { label: 'API entegrasyonu',     karnet: 'pro',     excel: 'no',  rakip: 'no'      },
  { label: 'Risk puanı',           karnet: 'yes',     excel: 'no',  rakip: 'no'      },
  { label: 'Nakit akışı tahmini',  karnet: 'pro',     excel: 'no',  rakip: 'no'      },
  { label: 'PDF rapor',            karnet: 'yes',     excel: 'no',  rakip: 'no'      },
  { label: 'Kurulum gerektirmez',  karnet: 'yes',     excel: 'no',  rakip: 'partial' },
  { label: 'Ücretsiz plan',        karnet: 'yes',     excel: 'yes', rakip: 'no'      },
];

function Cell({ value }: { value: string }) {
  if (value === 'yes') {
    return (
      <span className="inline-flex items-center justify-center">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/12">
          <Check className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
        </span>
      </span>
    );
  }
  if (value === 'pro') {
    return (
      <span className="inline-flex items-center justify-center">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/12">
          <Check className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
        </span>
      </span>
    );
  }
  if (value === 'no') {
    return (
      <span className="inline-flex items-center justify-center">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/12">
          <X className="h-4 w-4 text-red-400" strokeWidth={2.5} />
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center">
      <span className="text-xs font-medium text-amber-400 bg-amber-500/12 px-2 py-1 rounded-lg">
        Kısmi
      </span>
    </span>
  );
}

export function ComparisonTable() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#FBBF24' }}>
            Karşılaştırma
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4" style={{ letterSpacing: '-0.5px' }}>
            Rakiplerle Karşılaştırma
          </h2>
          <p className="text-[rgba(255,255,255,0.5)] text-base max-w-2xl mx-auto">
            Kârnet neden öne çıkıyor?
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr>
                <th className="text-left px-6 py-5 text-sm font-semibold text-[rgba(255,255,255,0.5)] w-1/2 rounded-tl-2xl">
                  Özellik
                </th>
                <th className="px-6 py-5 bg-amber-500/5 border-x border-amber-500/10 w-[18%] relative">
                  <div className="absolute -top-px left-0 right-0 h-0.5 rounded-t-full" style={{ background: 'linear-gradient(to right, #D97706, #F59E0B)' }} />
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-lg leading-none" style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}>
                      En İyi Seçim
                    </span>
                    <span className="text-sm font-bold text-amber-400">Kârnet</span>
                  </div>
                </th>
                <th className="px-6 py-5 text-sm font-semibold text-[rgba(255,255,255,0.5)] text-center w-[16%]">
                  Excel
                </th>
                <th className="px-6 py-5 text-sm font-semibold text-[rgba(255,255,255,0.5)] text-center w-[16%] rounded-tr-2xl">
                  Rakip Araçlar
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.06)]">
              {rows.map((row, i) => (
                <tr
                  key={row.label}
                  className="hover:bg-white/[0.02] transition-colors duration-150"
                >
                  <td className="px-6 py-4 text-sm font-medium text-foreground/80">
                    {row.label}
                  </td>
                  <td className="px-6 py-4 text-center bg-amber-500/[0.03] border-x border-amber-500/10">
                    <Cell value={row.karnet} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Cell value={row.excel} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Cell value={row.rakip} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
