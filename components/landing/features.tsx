
import { Calculator, Shield, BarChart3, Target } from 'lucide-react';

const features = [
    {
        icon: Calculator,
        title: 'Gerçek Kâr Hesaplama',
        desc: 'Komisyon, KDV, iade, reklam ve kargo dahil tüm giderleri hesaplayarak gerçek net kârınızı görün.',
    },
    {
        icon: Shield,
        title: 'Risk Analizi',
        desc: 'Ürün bazında risk puanı ve detaylı risk faktörleri ile zarardan kaçınmanıza, güvenli ticaret yapmanıza yardımcı olur.',
    },
    {
        icon: BarChart3,
        title: 'Hassasiyet Analizi',
        desc: 'Fiyat, komisyon ve reklam maliyetindeki değişikliklerin kârınıza etkisini anlık simüle edin.',
    },
    {
        icon: Target,
        title: 'Pazaryeri Karşılaştırma',
        desc: 'Aynı ürünü farklı pazaryerlerinde (Trendyol, Hepsiburada, N11, Amazon) karşılaştırarak en kârlı platformu belirleyin.',
    },
];

export function Features() {
    return (
        <section id="features" className="py-24 bg-card/30 border-y">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                        Neden Kârnet?
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Pazaryeri satışında gizli kalan tüm maliyetleri ortaya çıkarır, kârınızı ve riskinizi net olarak gösterir.
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
                    {features.map((feature) => (
                        <div
                            key={feature.title}
                            className="group relative rounded-2xl border bg-background p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/20"
                        >
                            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                <feature.icon className="h-6 w-6" />
                            </div>
                            <h3 className="mb-3 text-lg font-bold tracking-tight">{feature.title}</h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                {feature.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
