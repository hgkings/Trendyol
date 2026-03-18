import { Shield, Zap, Target, CreditCard } from 'lucide-react';

export function TrustCards() {
  const cards = [
    {
      icon: Shield,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      title: "Veri Güvenliği",
      desc: "Verileriniz şifreli sunucularda saklanır, asla üçüncü taraflarla paylaşılmaz."
    },
    {
      icon: Zap,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
      title: "Anlık Hesaplama",
      desc: "Tüm maliyet kalemleri saniyeler içinde hesaplanır, manuel işlem gerekmez."
    },
    {
      icon: Target,
      color: "text-green-500",
      bg: "bg-green-500/10",
      title: "Gerçek Veriler",
      desc: "Komisyon, kargo ve KDV oranları güncel pazaryeri verilerine göre hesaplanır."
    },
    {
      icon: CreditCard,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      title: "Kolay Başlangıç",
      desc: "Kredi kartı gerekmez. 5 dakikada hesap aç, hemen analiz yapmaya başla."
    }
  ];

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Güvenli ve Güvenilir Altyapı</h2>
          <p className="text-muted-foreground">Verileriniz güvende, hesaplamalarınız doğru</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {cards.map((card, idx) => (
            <div 
              key={idx} 
              className="rounded-2xl p-6 border border-border/50 hover:border-primary/30 hover:shadow-md transition-all duration-300 flex flex-col items-start text-left bg-card"
            >
              <div className={`${card.bg} ${card.color} p-3 rounded-xl mb-4`}>
                <card.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">{card.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
