import type { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export const metadata: Metadata = {
  title: 'Kullanım Şartları | Kârnet',
  description: 'Kârnet platform kullanım şartları ve koşulları.',
};

export default function KullanimSartlariPage() {
  return (
    <LegalPageLayout title="Kullanım Şartları">
      <p>
        Kârnet platformunu kullanan tüm kullanıcılar aşağıdaki şartları kabul
        etmiş sayılır:
      </p>

      <h2>Genel Kurallar</h2>
      <ul>
        <li>Platform yalnızca yasal amaçlarla kullanılabilir.</li>
        <li>Hizmetlerin kötüye kullanılması yasaktır.</li>
        <li>
          Kârnet, hizmetlerini geliştirmek amacıyla zaman zaman güncellemeler
          yapabilir.
        </li>
        <li>Kullanıcılar hesap güvenliğinden kendileri sorumludur.</li>
      </ul>

      <h2>Hesap Sorumluluğu</h2>
      <p>
        Her kullanıcı kendi hesap bilgilerinin güvenliğinden sorumludur.
        Şifrenizi başkalarıyla paylaşmayınız ve güçlü bir şifre
        kullanmanızı öneririz.
      </p>

      <h2>Hizmet Değişiklikleri</h2>
      <p>
        Kârnet, sunulan hizmetlerde önceden bildirimde bulunarak veya
        bulunmaksızın değişiklik yapma hakkını saklı tutar. Temel
        hizmetlerde yapılacak değişiklikler kullanıcılara bildirilir.
      </p>

      <h2>Sorumluluk Sınırı</h2>
      <p>
        Kârnet, platformun kesintisiz ve hatasız çalışacağını garanti etmez.
        Kullanıcılar verilerinin yedeklenmesinden kendileri sorumludur.
      </p>

      <h2>İletişim</h2>
      <p>
        Kullanım şartları ile ilgili her türlü soru ve önerileriniz için:<br />
        <strong>E-posta:</strong> karnet.destek@gmail.com<br />
        <strong>Telefon:</strong> +90 543 382 45 21<br />
        <strong>Adres:</strong> Konya Seydişehir, Ulukapı Mahallesi, 153103 Sokak No:52, Türkiye
      </p>
    </LegalPageLayout>
  );
}
