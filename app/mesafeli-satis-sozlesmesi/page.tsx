import type { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export const metadata: Metadata = {
  title: 'Mesafeli Satış Sözleşmesi | Kârnet',
  description: 'Kârnet mesafeli satış sözleşmesi. Hizmet, ödeme ve teslimat koşulları.',
};

export default function MesafeliSatisSozlesmesiPage() {
  return (
    <LegalPageLayout title="Mesafeli Satış Sözleşmesi">
      <h2>Satıcı Bilgileri</h2>
      <p>
        <strong>Unvan:</strong> Kârnet<br />
        <strong>Sahibi:</strong> Süleyman Hilmi İşbilir<br />
        <strong>Adres:</strong> Konya Seydişehir, Ulukapı Mahallesi, 153103 Sokak No:52, Türkiye<br />
        <strong>E-posta:</strong> karnet.destek@gmail.com<br />
        <strong>Telefon:</strong> +90 543 382 45 21
      </p>

      <h2>Hizmet</h2>
      <p>
        Kârnet platformu üzerinden sunulan Pro üyelik ve dijital yazılım
        hizmetleri.
      </p>

      <h2>Ödeme</h2>
      <p>
        Ödemeler PayTR ödeme altyapısı üzerinden güvenli şekilde
        alınmaktadır. Kredi kartı ve banka kartı ile ödeme yapılabilir.
      </p>

      <h2>Teslimat</h2>
      <p>
        Satın alınan dijital hizmetler ödeme tamamlandıktan sonra kullanıcı
        hesabına otomatik olarak tanımlanır. Hizmet teslimatı anlık olarak
        gerçekleştirilir.
      </p>

      <h2>Cayma Hakkı</h2>
      <p>
        6502 sayılı Tüketicinin Korunması Hakkında Kanun gereğince, dijital
        ortamda sunulan ve ödeme sonrasında erişime açılan hizmetlerde cayma
        hakkı bulunmamaktadır.
      </p>

      <h2>Yetkili Mahkeme</h2>
      <p>
        İşbu sözleşmeden doğan uyuşmazlıklarda Konya Mahkemeleri ve İcra
        Daireleri yetkilidir.
      </p>
    </LegalPageLayout>
  );
}
