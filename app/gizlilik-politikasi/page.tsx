import type { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export const metadata: Metadata = {
  title: 'Gizlilik Politikası | Kârnet',
  description: 'Kârnet gizlilik politikası. Kullanıcı verilerinin nasıl toplandığını ve korunduğunu öğrenin.',
};

export default function GizlilikPolitikasiPage() {
  return (
    <LegalPageLayout title="Gizlilik Politikası">
      <p>
        Kârnet olarak kullanıcılarımızın gizliliğini önemsiyoruz. Bu politika,
        web sitemizi kullanırken hangi verilerin toplandığını ve nasıl
        kullanıldığını açıklar.
      </p>

      <h2>Toplanan Bilgiler</h2>
      <ul>
        <li>Hesap oluştururken sağlanan e-posta adresi</li>
        <li>Kullanım verileri</li>
        <li>Teknik bilgiler (IP adresi, cihaz ve tarayıcı bilgisi)</li>
      </ul>

      <h2>Verilerin Kullanımı</h2>
      <ul>
        <li>Hizmetlerin sağlanması</li>
        <li>Kullanıcı deneyiminin geliştirilmesi</li>
        <li>Destek hizmetlerinin sağlanması</li>
      </ul>

      <h2>Veri Güvenliği</h2>
      <p>
        Kullanıcı verileri güvenli sunucularda saklanır ve yasal zorunluluklar
        dışında üçüncü kişilerle paylaşılmaz.
      </p>
    </LegalPageLayout>
  );
}
