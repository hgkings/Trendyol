'use client';

import Image from 'next/image';

const marketplaces = [
  {
    logo: '/brand/trendyol-logo.svg',
    name: 'Trendyol',
    desc: "Türkiye'nin en büyük pazaryeri. Komisyon, servis bedeli ve KDV dahil tam analiz.",
    badge: 'En Popüler',
  },
  {
    logo: '/brand/hepsiburada-logo.svg',
    name: 'Hepsiburada',
    desc: 'İşlem bedeli ve hizmet bedeli dahil gerçek kârlılık analizi.',
    badge: null,
  },
  {
    logo: '/brand/n11-logo.svg',
    name: 'n11',
    desc: 'Pazarlama ve pazaryeri hizmet bedelleri dahil net kâr hesaplama.',
    badge: null,
  },
  {
    logo: '/brand/amazon-tr-logo.svg',
    name: 'Amazon TR',
    desc: 'Referral fee ve fiyat dilimi bazlı komisyon hesaplama.',
    badge: null,
  },
];

export function MarketplaceCards() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-sm font-semibold uppercase tracking-wider mb-3 text-amber-800 dark:text-amber-300">
            Entegrasyonlar
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4" style={{ letterSpacing: '-0.5px' }}>
            Desteklenen Pazaryerleri
          </h2>
          <p className="text-muted-foreground text-base max-w-2xl mx-auto">
            Tüm büyük pazaryerlerinde kârlılığınızı hesaplayın
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {marketplaces.map((mp) => (
            <div
              key={mp.name}
              className="group relative rounded-2xl border border-border/40 bg-card p-6 hover:scale-[1.02] hover:border-amber-500/30 hover:shadow-lg transition-all duration-300 cursor-default"
            >
              {mp.badge && (
                <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/12 text-amber-700 dark:text-amber-400">
                  {mp.badge}
                </span>
              )}
              <div className="mb-4">
                <Image
                  src={mp.logo}
                  alt={`${mp.name} logo`}
                  width={48}
                  height={48}
                  className="rounded-xl"
                />
              </div>
              <h3 className="font-bold text-foreground mb-2">{mp.name}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{mp.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
