export function MarketplaceCards() {
  const marketplaces = [
    {
      name: "Trendyol",
      color: "#F27A1A",
      borderColor: "border-t-[#F27A1A]",
      badge: "En Popüler",
      desc: "Türkiye'nin en büyük pazaryeri. Platform hizmet bedeli ve KDV dahil tam kârlılık analizi.",
      emoji: "🟠"
    },
    {
      name: "Hepsiburada", 
      color: "#FF6000",
      borderColor: "border-t-[#FF6000]",
      badge: null,
      desc: "İşlem bedeli (7₺) ve hizmet bedeli dahil gerçek kârlılık analizi.",
      emoji: "🔵"
    },
    {
      name: "n11",
      color: "#7B2FBE", 
      borderColor: "border-t-[#7B2FBE]",
      badge: null,
      desc: "Pazarlama (%1.20) ve pazaryeri hizmet bedeli dahil net kâr hesaplama.",
      emoji: "🟣"
    },
    {
      name: "Amazon TR",
      color: "#FF9900",
      borderColor: "border-t-[#FF9900]", 
      badge: null,
      desc: "Fiyat dilimi bazlı komisyon ve referral fee hesaplama.",
      emoji: "🟡"
    }
  ];

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Desteklenen Pazaryerleri</h2>
          <p className="text-muted-foreground">Tüm büyük pazaryerlerinde kârlılığınızı hesaplayın</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {marketplaces.map((m, idx) => (
            <div 
              key={idx} 
              className={`relative rounded-2xl p-6 border border-border/50 hover:scale-[1.02] hover:shadow-lg hover:border-primary/30 transition-all duration-300 flex flex-col items-center text-center bg-card border-t-4 ${m.borderColor}`}
            >
              {m.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-sm">
                  {m.badge}
                </div>
              )}
              <div className="text-4xl mb-4" aria-hidden="true">{m.emoji}</div>
              <h3 className="text-xl font-bold mb-3" style={{ color: m.color }}>{m.name}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {m.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
