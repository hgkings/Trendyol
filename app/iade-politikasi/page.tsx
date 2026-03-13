import type { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export const metadata: Metadata = {
  title: 'İade Politikası | Kârnet',
  description: 'Kârnet iade politikası. Dijital hizmetlerde iade koşulları hakkında bilgi.',
};

export default function IadePolitikasiPage() {
  return (
    <LegalPageLayout title="İade Politikası">
      <p>
        Kârnet üzerinden satın alınan hizmetler dijital ürün kapsamına
        girmektedir.
      </p>

      <p>
        Dijital hizmetlerde ödeme sonrasında hizmet erişimi sağlandığı için
        iade yapılmamaktadır.
      </p>

      <h2>Sorun Bildirimi</h2>
      <p>
        Herhangi bir sorun yaşanması durumunda destek ekibimiz ile iletişime
        geçebilirsiniz:
      </p>
      <ul>
        <li>
          <strong>E-posta:</strong> karnet.destek@gmail.com
        </li>
        <li>
          <strong>Telefon:</strong> +90 543 382 45 21
        </li>
        <li>
          <strong>Destek sayfası:</strong> Platform içi destek sistemi
        </li>
      </ul>

      <p>
        Teknik bir sorun nedeniyle hizmet hiç kullanılamamış ise destek
        ekibimiz durumu değerlendirecektir.
      </p>
    </LegalPageLayout>
  );
}
