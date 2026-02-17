import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
    {
        q: 'KDV nasıl hesaplanıyor?',
        a: 'Kârnet, ürün bazında KDV oranını ayrıştırarak net (KDV hariç) ve brüt (KDV dahil) değerleri gösterir. Pro modda satış, alış ve gider bazlı KDV\'leri ayrı ayrı ayarlayabilirsiniz.',
    },
    {
        q: 'İade oranı kârı nasıl etkiliyor?',
        a: 'İade edilen ürünlerde hem satış geliri kaybolur hem de ekstra kargo/operasyon maliyeti oluşur. Kârnet, belirlediğiniz iade oranını aylık satış hacmine uygulayarak gerçek net kârı hesaplar.',
    },
    {
        q: 'Hangi pazaryerleri destekleniyor?',
        a: 'Trendyol, Hepsiburada, N11 ve Amazon Türkiye desteklenmektedir. Her pazaryeri için varsayılan komisyon, iade oranı ve ödeme gecikme süresi otomatik doldurulur.',
    },
    {
        q: 'Ücretsiz plan ile Pro plan arasındaki fark nedir?',
        a: 'Ücretsiz planda 5 ürüne kadar analiz yapabilirsiniz. Pro plan: sınırsız analiz, PRO Muhasebe Modu (detaylı KDV ayrıştırma), PDF rapor indirme, e-posta risk bildirimleri ve öncelikli destek sunar.',
    },
    {
        q: 'Verilerim güvende mi?',
        a: 'Evet. Verileriniz Supabase altyapısında şifreli olarak saklanır. Üçüncü taraflarla paylaşılmaz, reklam amacıyla kullanılmaz. İstediğiniz zaman hesabınızı ve tüm verilerinizi silebilirsiniz.',
    },
    {
        q: 'Hesaplama ne kadar doğru?',
        a: 'Kârnet, girdiğiniz verilere dayalı olarak hesaplama yapar. Komisyon, KDV, kargo, reklam, iade ve diğer giderleri eksiksiz dahil eder. Sonuçlar, girilen verilerin doğruluğu kadar kesindir.',
    },
];

export function FAQSection() {
    return (
        <section id="faq" className="py-20 sm:py-24 bg-card/30 border-y">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                        Sıkça Sorulan Sorular
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Merak ettiklerinizi hızlıca yanıtlıyoruz.
                    </p>
                </div>

                <Accordion type="single" collapsible className="w-full space-y-3">
                    {faqs.map((faq, i) => (
                        <AccordionItem
                            key={i}
                            value={`faq-${i}`}
                            className="rounded-xl border bg-background px-5 data-[state=open]:shadow-sm transition-shadow"
                        >
                            <AccordionTrigger className="py-4 text-[15px] font-semibold hover:no-underline hover:text-primary text-left">
                                {faq.q}
                            </AccordionTrigger>
                            <AccordionContent className="pb-4 text-sm text-muted-foreground leading-relaxed">
                                {faq.a}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </section>
    );
}
