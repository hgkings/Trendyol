'use client';

export function SocialProofBar() {
  const marketplaces = [
    { name: 'Trendyol', color: '#F27A1A' },
    { name: 'Hepsiburada', color: '#FF6000' },
    { name: 'n11', color: '#7D2B8B' },
    { name: 'Amazon TR', color: '#FF9900' },
  ];

  const items = [...marketplaces, ...marketplaces, ...marketplaces, ...marketplaces];

  return (
    <div className="border-y border-border/40 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-6">
          Türkiye&apos;nin önde gelen pazaryerlerini destekler
        </p>
        <div className="marquee-container">
          <div className="marquee-track gap-8">
            {items.map((mp, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 shrink-0 px-5 py-2.5 rounded-xl border border-border/40 bg-muted/10"
              >
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0 opacity-40"
                  style={{ backgroundColor: mp.color }}
                />
                <span className="text-sm font-semibold text-muted-foreground/40 whitespace-nowrap">
                  {mp.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
