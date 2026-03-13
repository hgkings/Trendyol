import type { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export const metadata: Metadata = {
  title: 'Hakkımızda | Kârnet',
  description: 'Kârnet hakkında bilgi edinin. İşletmelerin satış ve kâr takibini kolaylaştıran yazılım platformu.',
};

export default function HakkimizdaPage() {
  return (
    <LegalPageLayout title="Hakkımızda">
      <p>
        Kârnet, işletmelerin satışlarını ve kârlarını daha kolay takip
        edebilmesi için geliştirilen bir yazılım platformudur.
      </p>

      <p>
        Platform, kullanıcıların satış verilerini analiz etmelerine,
        performanslarını görmelerine ve işlerini daha verimli yönetmelerine
        yardımcı olmayı amaçlar.
      </p>

      <p>
        Kârnet, sade ve kullanımı kolay bir arayüz ile işletmelerin karmaşık
        raporlamalarla uğraşmadan verilerini anlamalarını sağlar.
      </p>

      <p>
        <strong>Misyonumuz</strong>, işletmeler için veri takibini kolay ve
        erişilebilir hale getirmektir.
      </p>

      <h2>İletişim</h2>
      <p>
        <strong>E-posta:</strong> karnet.destek@gmail.com<br />
        <strong>Telefon:</strong> +90 543 382 45 21<br />
        <strong>Adres:</strong> Konya Seydişehir, Ulukapı Mahallesi, 153103 Sokak No:52, Türkiye
      </p>
    </LegalPageLayout>
  );
}
