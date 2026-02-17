import { Clock, Layers, Target } from 'lucide-react';

const stats = [
    { icon: Clock, value: '2 dk', label: 'Ortalama analiz süresi' },
    { icon: Layers, value: '8+', label: 'Gider kalemi hesaplanır' },
    { icon: Target, value: 'Akıllı', label: 'Risk puanı + önerilen fiyat' },
];

export function SocialProofBar() {
    return (
        <section className="border-y bg-card/50">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    {stats.map((stat) => (
                        <div
                            key={stat.label}
                            className="flex items-center justify-center gap-3 py-5 sm:py-6"
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                                <stat.icon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-lg font-bold tracking-tight">{stat.value}</p>
                                <p className="text-xs text-muted-foreground">{stat.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
