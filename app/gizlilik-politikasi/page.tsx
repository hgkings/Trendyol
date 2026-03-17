import type { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export const metadata: Metadata = {
  title: 'Gizlilik Politikası ve KVKK Aydınlatma Metni | Kârnet',
  description: 'Kârnet gizlilik politikası ve 6698 sayılı KVKK kapsamında aydınlatma metni.',
};

export default function GizlilikPolitikasiPage() {
  return (
    <LegalPageLayout title="Gizlilik Politikası ve KVKK Aydınlatma Metni">
      <p>
        Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) kapsamında veri
        sorumlusu sıfatıyla hazırlanmış aydınlatma metnidir.
      </p>

      <h2>Veri Sorumlusu</h2>
      <p>
        <strong>Ad Soyad:</strong> Süleyman Hilmi İşbilir<br />
        <strong>Adres:</strong> Konya Seydişehir, Ulukapı Mahallesi, 153103 Sokak No:52, Türkiye<br />
        <strong>E-posta:</strong> karnet.destek@gmail.com<br />
        <strong>Telefon:</strong> +90 543 382 45 21
      </p>

      <h2>Toplanan Kişisel Veriler</h2>
      <ul>
        <li>Ad-soyad (isteğe bağlı)</li>
        <li>E-posta adresi</li>
        <li>Kullanım ve analiz verileri</li>
        <li>IP adresi, cihaz ve tarayıcı bilgisi</li>
        <li>
          Ödeme bilgileri (PayTR altyapısıyla işlenir; kart verileri tarafımızca saklanmaz)
        </li>
      </ul>

      <h2>İşleme Amaçları</h2>
      <ul>
        <li>Hizmetin sunulması ve sürdürülmesi</li>
        <li>Hesap yönetimi ve kimlik doğrulama</li>
        <li>Ödeme işlemlerinin gerçekleştirilmesi</li>
        <li>Müşteri destek hizmetleri</li>
        <li>Yasal yükümlülüklerin yerine getirilmesi</li>
        <li>Hizmet kalitesinin iyileştirilmesi</li>
      </ul>

      <h2>Hukuki Dayanak (KVKK Madde 5)</h2>
      <ul>
        <li>Sözleşmenin ifası</li>
        <li>Meşru menfaat</li>
        <li>Açık rıza (pazarlama iletişimleri için)</li>
        <li>Yasal yükümlülük</li>
      </ul>

      <h2>Veri Saklama Süreleri</h2>
      <ul>
        <li>Hesap verileri: Hesap silinene kadar</li>
        <li>Ödeme kayıtları: 10 yıl (Vergi Usul Kanunu gereği)</li>
        <li>Log verileri: 2 yıl</li>
        <li>Destek yazışmaları: 3 yıl</li>
      </ul>

      <h2>Üçüncü Taraflarla Paylaşım</h2>
      <p>
        Kişisel verileriniz; hizmetin sunulması için zorunlu olmadıkça üçüncü kişilerle
        paylaşılmaz. Kullandığımız altyapı sağlayıcıları:
      </p>
      <ul>
        <li>Supabase (veri tabanı — AB GDPR uyumlu)</li>
        <li>PayTR (ödeme işleme)</li>
        <li>Vercel (hosting)</li>
      </ul>

      <h2>Kullanıcı Hakları (KVKK Madde 11)</h2>
      <p>Aşağıdaki haklara sahipsiniz:</p>
      <ul>
        <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
        <li>İşlenmişse bilgi talep etme</li>
        <li>İşlenme amacını öğrenme</li>
        <li>Yurt içi/dışı aktarılan üçüncü kişileri bilme</li>
        <li>Eksik veya yanlış işlenmişse düzeltme talep etme</li>
        <li>Silinmesini veya yok edilmesini talep etme</li>
        <li>İtiraz etme</li>
        <li>Zararın giderilmesini talep etme</li>
      </ul>
      <p>
        Haklarınızı kullanmak için:{' '}
        <a href="mailto:karnet.destek@gmail.com">karnet.destek@gmail.com</a>
      </p>

      <h2>Çerezler (Cookies)</h2>
      <ul>
        <li>Oturum çerezleri (zorunlu)</li>
        <li>Analitik çerezler (isteğe bağlı)</li>
      </ul>
      <p>Tarayıcı ayarlarından çerezleri devre dışı bırakabilirsiniz.</p>

      <h2>Değişiklikler</h2>
      <p>
        Bu politika güncellenebilir. Önemli değişikliklerde e-posta ile bildirim yapılır.
      </p>
      <p>
        <strong>Son güncelleme:</strong> Mart 2026
      </p>
    </LegalPageLayout>
  );
}
