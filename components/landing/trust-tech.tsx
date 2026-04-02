'use client';

import { Shield, Lock, Eye, ServerCrash, KeyRound, Database } from 'lucide-react';

const cards = [
  {
    icon: Lock,
    title: 'AES-256 Şifreleme',
    desc: 'Pazaryeri API anahtarlarınız askeri düzey şifreleme ile korunur. Şifreler sunucuda bile düz metin olarak saklanmaz.',
  },
  {
    icon: Shield,
    title: 'Katmanlı Güvenlik',
    desc: '9 katmanlı mimari sayesinde verilerinize sadece yetkili katmanlar erişebilir. Hiçbir kullanıcı verisi UI katmanında işlenmez.',
  },
  {
    icon: Eye,
    title: 'Satır Düzeyinde Koruma',
    desc: 'Her kullanıcı sadece kendi verilerini görebilir. Veritabanı seviyesinde Row Level Security (RLS) ile korunur.',
  },
  {
    icon: KeyRound,
    title: 'Güvenli Kimlik Doğrulama',
    desc: 'JWT tabanlı oturum yönetimi, şifrelenmiş cookie\'ler ve otomatik oturum yenileme ile hesabınız güvende.',
  },
  {
    icon: Database,
    title: 'Günlük Yedekleme',
    desc: 'Verileriniz her gün otomatik yedeklenir. Olası bir aksaklıkta bile verileriniz kaybolmaz.',
  },
  {
    icon: ServerCrash,
    title: 'Sıfır Veri Paylaşımı',
    desc: 'Verileriniz asla üçüncü taraflarla paylaşılmaz, reklam amacıyla kullanılmaz. Verilerinizin tek sahibi sizsiniz.',
  },
];

export function TrustTech() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider mb-3 text-amber-800 dark:text-amber-300">
            Güvenlik
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4" style={{ letterSpacing: '-0.5px' }}>
            Verileriniz Bizimle Güvende
          </h2>
          <p className="text-muted-foreground text-base max-w-2xl mx-auto">
            Banka düzeyinde şifreleme ve katmanlı güvenlik mimarisi ile verilerinizi koruyoruz
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((card) => (
            <div
              key={card.title}
              className="group rounded-2xl border border-border/40 bg-card p-6 hover:border-emerald-500/20 hover:shadow-md transition-all duration-300"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/15 bg-emerald-500/8 mb-4">
                <card.icon className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold text-foreground mb-2 text-sm md:text-base">
                {card.title}
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
