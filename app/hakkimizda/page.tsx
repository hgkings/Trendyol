import type { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export const metadata: Metadata = {
  title: 'Hakkımızda | Kârnet',
  description: 'Kârnet; komisyon, kargo, iade ve KDV gibi gizli maliyetleri otomatik hesaplayarak pazaryeri satıcılarına gerçek kâr analizi sunar.',
};

const STATS = [
  { icon: '📦', value: '5+', label: 'Gider Kalemi', sub: 'Otomatik hesaplanır' },
  { icon: '⏱', value: '2 Dakika', label: 'Ortalama analiz süresi', sub: '' },
  { icon: '🏪', value: '4 Pazaryeri', label: 'Trendyol, Hepsiburada, n11, Amazon TR', sub: '' },
];

const VALUES = [
  {
    icon: '🔒',
    title: 'Şeffaflık',
    desc: 'Gizli ücret yoktur. Verileriniz satılmaz. Ne görüyorsanız o.',
  },
  {
    icon: '🎯',
    title: 'Doğruluk',
    desc: 'Hesaplamalar gerçek pazaryeri maliyet yapılarına göre yapılır.',
  },
  {
    icon: '💡',
    title: 'Sadelik',
    desc: 'Muhasebe bilgisi gerektirmez. Her satıcı kullanabilir.',
  },
];

export default function HakkimizdaPage() {
  return (
    <LegalPageLayout title="Kârnet Hakkında">

      {/* Mission */}
      <h2>Neden Kârnet&apos;i Yaptık?</h2>
      <p>
        Trendyol, Hepsiburada ve diğer pazaryerlerinde satış yapan on binlerce satıcı,
        her ay komisyon, kargo, iade ve KDV gibi gizli maliyetler yüzünden farkında
        olmadan zarar ediyor.
      </p>
      <p>
        Kârnet; bu gider kalemlerini otomatik hesaplayarak satıcıların hangi ürünlerde
        gerçekten kâr ettiklerini, hangilerinde zarar ettiklerini net olarak görmelerini
        sağlar.
      </p>
      <p>
        Excel tablolarında saatlerce uğraşmak yerine 2 dakikada güvenilir bir analiz
        almanın zamanı geldi.
      </p>

      {/* Stats */}
      <div className="not-prose grid grid-cols-1 sm:grid-cols-3 gap-4 my-8">
        {STATS.map((s) => (
          <div
            key={s.value}
            className="rounded-2xl border border-border bg-muted/30 p-5 text-center space-y-1"
          >
            <div className="text-2xl leading-none">{s.icon}</div>
            <div className="text-xl font-black text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground leading-snug">{s.label}</div>
            {s.sub && <div className="text-xs text-muted-foreground">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Values */}
      <h2>İlkelerimiz</h2>
      <div className="not-prose grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        {VALUES.map((v) => (
          <div
            key={v.title}
            className="rounded-2xl border border-border/40 bg-card p-5 space-y-2"
          >
            <div className="text-xl leading-none">{v.icon}</div>
            <div className="font-semibold text-foreground">{v.title}</div>
            <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
          </div>
        ))}
      </div>

      {/* Developer note */}
      <h2>Geliştirici</h2>
      <p>
        Kârnet, Konya&apos;dan bir girişimci tarafından e-ticaret satıcılarının
        gerçek ihtiyaçlarını karşılamak amacıyla geliştirilmektedir.
      </p>
      <p>
        İletişim:{' '}
        <a href="mailto:karnet.destek@gmail.com">karnet.destek@gmail.com</a>
      </p>

      {/* Contact */}
      <h2>İletişim</h2>
      <p>
        <strong>E-posta:</strong> karnet.destek@gmail.com<br />
        <strong>Adres:</strong> Konya, Türkiye
      </p>

    </LegalPageLayout>
  );
}
