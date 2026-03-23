export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: number; // dakika cinsinden
  content: string; // HTML içerik
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'trendyolda-gercek-kar-nasil-hesaplanir',
    title: "Trendyol'da Gerçek Kârınızı Nasıl Hesaplarsınız?",
    description:
      "Komisyon, kargo, iade ve vergi maliyetlerini hesaba katmadan satış rakamlarınıza bakıyorsanız, aslında ne kadar kazandığınızı bilmiyorsunuz demektir. İşte gerçek kâr hesaplama rehberi.",
    date: '2026-03-20',
    readTime: 7,
    content: `
<p>Trendyol'da satış yapan birçok satıcı, ciro rakamlarına bakarak "iyi gidiyor" diye düşünür. Oysa asıl önemli olan, cepte kalan net kârdır. Bu yazıda, platforma özgü tüm maliyetleri hesaba katarak gerçek kârınızı nasıl hesaplayacağınızı adım adım anlatıyoruz.</p>

<h2>1. Brüt Gelir Yanıltıcı Olabilir</h2>
<p>Diyelim ki bir ürünü 200 TL'ye sattınız. Bu 200 TL'nin tamamı size gelmiyor. Önce şu kesintileri çıkarmanız gerekiyor:</p>
<ul>
  <li><strong>Trendyol komisyonu:</strong> Kategoriye göre %8–%22 arasında değişir.</li>
  <li><strong>Kargo maliyeti:</strong> Kargo bedava kampanyasına dahilseniz bu ücret size yansır.</li>
  <li><strong>İade kargo ücreti:</strong> Müşteri iade ederse kargo bedeli genellikle satıcıdan kesilir.</li>
  <li><strong>Trendyol Ek Hizmet Bedeli (varsa):</strong> Reklam, vitrin gibi ücretli hizmetler.</li>
</ul>

<h2>2. Ürün Maliyetini Doğru Hesaplayın</h2>
<p>Ürün başına maliyet sadece tedarikçiden ödediğiniz fiyat değildir. Şunları da dahil etmelisiniz:</p>
<ul>
  <li>Hammadde veya tedarik maliyeti</li>
  <li>Paketleme (kutu, bant, balonlu naylon vb.)</li>
  <li>Depo/kira payı (ürün başına düşen)</li>
  <li>İşçilik (kendiniz yapıyorsanız bile saatinizin değeri)</li>
</ul>

<h2>3. İade Oranını Hesaba Katın</h2>
<p>E-ticarette iade oranları %10–%30 arasında olabilir. 100 ürün satıp 20'si iade gelirse, o 20 ürün için hem komisyon hem kargo hem de stok kaybı yaşarsınız. Ortalama iade oranınızı biliyorsanız bunu kâr hesaplamanıza yansıtın.</p>
<p><em>Örnek:</em> %15 iade oranında 100 ürün sattıysanız, efektif satışınız 85 üründür. Kâr hesabınızı buna göre yapın.</p>

<h2>4. Vergi ve Fatura Maliyetleri</h2>
<p>Şahıs şirketi veya limited şirketle faaliyet gösteriyorsanız:</p>
<ul>
  <li>KDV: Ürünün KDV oranına göre (%1, %10 veya %20) hesaplayın.</li>
  <li>Gelir/Kurumlar Vergisi: Yıllık kâr üzerinden ödenir.</li>
  <li>Muhasebeci ücreti: Aylık sabit gider olarak ürün bazında paylaştırın.</li>
</ul>

<h2>5. Gerçek Kâr Formülü</h2>
<p>Tüm bu bilgileri bir araya getirdiğinizde gerçek kâr formülü şöyle çıkar:</p>
<pre><code>Net Kâr = Satış Fiyatı
        − Trendyol Komisyonu
        − Kargo Bedeli
        − Ürün Maliyeti
        − Paketleme Maliyeti
        − İade Payı
        − Genel Gider Payı
        − Vergi Payı</code></pre>

<h2>6. Kârnet ile Otomatik Hesaplayın</h2>
<p>Yukarıdaki formülü her ürün için tek tek hesaplamak hem zaman alır hem de hata riski taşır. Kârnet, tüm bu değişkenleri sizin yerinize hesaplayarak her ürün için net kâr marjınızı, başabaş noktanızı ve kârlılık skoru gösterir.</p>
<p>Ücretsiz hesap oluşturun, ürünlerinizi analiz edin ve hangisinin gerçekten para kazandırdığını görün.</p>
    `.trim(),
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
