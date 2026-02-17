import { CreditCard, ShieldCheck, Trash2 } from 'lucide-react';

const items = [
    { icon: CreditCard, text: 'Kredi kartı gerekmez' },
    { icon: ShieldCheck, text: 'Veriler satılmaz' },
    { icon: Trash2, text: 'İstediğin zaman sil' },
];

export function TrustStrip() {
    return (
        <section className="py-10 sm:py-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
                    {items.map((item) => (
                        <div
                            key={item.text}
                            className="flex items-center gap-2.5 text-sm text-muted-foreground"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                                <item.icon className="h-4 w-4" />
                            </div>
                            <span className="font-medium">{item.text}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
