import { Shield, Lock, Eye, KeyRound, Database, ShieldOff } from 'lucide-react';

export function TrustCards() {
  const cards = [
    {
      icon: Lock,
      title: "AES-256 Şifreleme",
      desc: "Pazaryeri API anahtarlarınız askeri düzey şifreleme ile korunur. Şifreler sunucuda bile düz metin olarak saklanmaz."
    },
    {
      icon: Shield,
      title: "Katmanlı Güvenlik",
      desc: "9 katmanlı mimari sayesinde verilerinize sadece yetkili katmanlar erişebilir. Hiçbir kullanıcı verisi açık katmanda işlenmez."
    },
    {
      icon: Eye,
      title: "Satır Düzeyinde Koruma",
      desc: "Her kullanıcı sadece kendi verilerini görebilir. Veritabanı seviyesinde erişim kontrolü ile korunur."
    },
    {
      icon: KeyRound,
      title: "Güvenli Kimlik Doğrulama",
      desc: "JWT tabanlı oturum yönetimi, şifrelenmiş cookie'ler ve otomatik oturum yenileme ile hesabınız güvende."
    },
    {
      icon: Database,
      title: "Günlük Yedekleme",
      desc: "Verileriniz her gün otomatik yedeklenir. Olası bir aksaklıkta bile verileriniz kaybolmaz."
    },
    {
      icon: ShieldOff,
      title: "Sıfır Veri Paylaşımı",
      desc: "Verileriniz asla üçüncü taraflarla paylaşılmaz, reklam amacıyla kullanılmaz. Verilerinizin tek sahibi sizsiniz."
    }
  ];

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#34D399' }}>
            Güvenlik
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight" style={{ letterSpacing: '-0.5px' }}>
            Verileriniz Bizimle Güvende
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Banka düzeyinde şifreleme ve katmanlı güvenlik mimarisi ile verilerinizi koruyoruz
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {cards.map((card, idx) => (
            <div
              key={idx}
              className="rounded-2xl p-6 border border-border/40 bg-card hover:border-emerald-500/20 hover:shadow-md transition-all duration-300 flex flex-col items-start text-left"
            >
              <div className="bg-emerald-500/8 border border-emerald-500/15 text-emerald-700 dark:text-emerald-400 p-3 rounded-xl mb-4">
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
