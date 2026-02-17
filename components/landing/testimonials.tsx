import { Star, BadgeCheck } from 'lucide-react';

const testimonials = [
    {
        quote: 'İade ve komisyonu dahil edince aslında zarar ettiğimi gördüm. 3 ürünü listeden çıkardım, kâr %40 arttı.',
        name: 'Emre K.',
        role: 'Trendyol Satıcısı',
        verified: true,
        stars: 5,
    },
    {
        quote: 'Müşterilerime hangi ürünlerde kâr ettiklerini somut verilerle gösterebiliyorum. Profesyonel ve güvenilir.',
        name: 'Seda A.',
        role: 'E-ticaret Danışmanı',
        verified: true,
        stars: 5,
    },
    {
        quote: 'Excel\'de saatlerce uğraşıyordum. Kârnet ile 2 dakikada aynı sonuca ulaşıyorum. Hatta daha doğru.',
        name: 'Murat T.',
        role: 'Hepsiburada Satıcısı',
        verified: false,
        stars: 5,
    },
];

function Stars({ count }: { count: number }) {
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: count }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
            ))}
        </div>
    );
}

export function Testimonials() {
    return (
        <section className="py-20 sm:py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-2xl mx-auto mb-14">
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                        Kullanıcılar Ne Diyor?
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Kârnet ile kârlılığını artıran satıcıların deneyimleri.
                    </p>
                </div>

                {/* Desktop Grid / Mobile Horizontal Scroll */}
                <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-muted/50 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0">
                    {testimonials.map((t) => (
                        <div
                            key={t.name}
                            className="flex-shrink-0 w-[320px] sm:w-[340px] lg:w-auto snap-center rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-premium-md hover:border-primary/20"
                        >
                            <Stars count={t.stars} />

                            <blockquote className="mt-4 mb-6 text-[15px] leading-relaxed text-foreground/90">
                                &ldquo;{t.quote}&rdquo;
                            </blockquote>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold">{t.name}</p>
                                    <p className="text-xs text-muted-foreground">{t.role}</p>
                                </div>
                                {t.verified && (
                                    <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                        <BadgeCheck className="h-3 w-3" />
                                        Doğrulanmış
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
