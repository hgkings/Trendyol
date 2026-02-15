
import { CheckCircle2 } from 'lucide-react';

const benefits = [
    'Pazaryeri komisyonu',
    'KDV hesaplaması',
    'İade kaybı tahmini',
    'Reklam maliyeti',
    'Kargo ücreti',
    'Paketleme maliyeti',
    'Diğer giderler',
    'Başa baş noktası analizi',
    'Nakit akışı tahmini',
    'Rakip fiyat analizi (Yakında)',
    'Stok maliyet hesabı',
    'Döviz kuru etkisi',
];

export function BenefitsList() {
    return (
        <section className="py-24 bg-card/50 border-y">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                        Hesaplama Neleri İçeriyor?
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Basit bir kâr hesabından çok daha fazlası. Tüm e-ticaret giderlerinizi tek panelde görün.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
                    {benefits.map((item) => (
                        <div
                            key={item}
                            className="flex items-center gap-3 rounded-xl border bg-background/50 p-4 transition-colors hover:bg-background hover:border-primary/20"
                        >
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                            <span className="font-medium">{item}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
