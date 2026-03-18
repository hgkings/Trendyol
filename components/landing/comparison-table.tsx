export function ComparisonTable() {
    const features = [
      { name: "Gerçek net kâr hesaplama", karnet: true, excel: false, rival: "partial" },
      { name: "KDV ayrıştırma (PRO)", karnet: true, excel: false, rival: false },
      { name: "İade maliyet analizi", karnet: true, excel: false, rival: false },
      { name: "4 pazaryeri desteği", karnet: true, excel: false, rival: "partial" },
      { name: "Trendyol/Hepsiburada API", karnet: true, excel: false, rival: false },
      { name: "Risk puanı ve uyarı", karnet: true, excel: false, rival: false },
      { name: "Nakit akışı tahmini (PRO)", karnet: true, excel: false, rival: false },
      { name: "PDF rapor", karnet: true, excel: false, rival: false },
      { name: "Kurulum gerektirmez", karnet: true, excel: false, rival: "partial" },
      { name: "Ücretsiz plan", karnet: true, excel: true, rival: false },
    ];
  
    const renderIcon = (value: boolean | string) => {
      if (value === true) return <span className="text-emerald-500 font-bold">✓</span>;
      if (value === false) return <span className="text-red-500 font-bold">✗</span>;
      if (value === "partial") return <span className="text-amber-500 font-medium text-xs bg-amber-500/10 px-2 py-0.5 rounded-full">Kısmi</span>;
      return null;
    };
  
    return (
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Rakiplerle Karşılaştırma</h2>
            <p className="text-muted-foreground">Kârnet neden öne çıkıyor?</p>
          </div>
  
          <div className="max-w-4xl mx-auto overflow-x-auto pb-4">
            <div className="min-w-[600px]">
              {/* Header row */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="col-span-1"></div>
                
                {/* Karnet Column Header */}
                <div className="col-span-1 relative bg-primary/5 border border-primary/30 rounded-t-xl p-4 text-center">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    En İyi Seçim
                  </div>
                  <h3 className="font-bold text-lg mt-1">Kârnet</h3>
                </div>
                
                <div className="col-span-1 p-4 text-center flex flex-col justify-end">
                  <h3 className="font-semibold text-muted-foreground">Excel</h3>
                </div>
                
                <div className="col-span-1 p-4 text-center flex flex-col justify-end">
                  <h3 className="font-semibold text-muted-foreground">Diğer Araçlar</h3>
                </div>
              </div>
  
              {/* Rows */}
              <div className="space-y-2">
                {features.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2 text-sm border-b border-border/50 pb-2 items-center">
                    <div className="col-span-1 font-medium pl-2">{item.name}</div>
                    <div className="col-span-1 bg-primary/5 border-x border-primary/30 py-3 text-center flex items-center justify-center">
                      {renderIcon(item.karnet)}
                    </div>
                    <div className="col-span-1 text-center py-3 flex items-center justify-center">
                      {renderIcon(item.excel)}
                    </div>
                    <div className="col-span-1 text-center py-3 flex items-center justify-center">
                      {renderIcon(item.rival)}
                    </div>
                  </div>
                ))}
                
                {/* Bottom border for Karnet column */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-1"></div>
                  <div className="col-span-1 bg-primary/5 border-b border-x border-primary/30 h-4 rounded-b-xl"></div>
                  <div className="col-span-1"></div>
                  <div className="col-span-1"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }
