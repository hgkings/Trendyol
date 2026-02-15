
import { CheckCircle2 } from 'lucide-react';

const steps = [
    { step: '1', title: 'Ürün Bilgilerini Gir', desc: 'Pazaryeri, fiyat, maliyet ve diğer gider bilgilerini girin.' },
    { step: '2', title: 'Analiz Et', desc: 'Sistem tüm maliyetleri hesaplayarak gerçek kârınızı ve risk seviyenizi belirler.' },
    { step: '3', title: 'Karar Ver', desc: 'Detaylı rapor ve önerilere dayanarak stratejik kararlar alın.' },
];

export function HowItWorks() {
    return (
        <section id="how-it-works" className="py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                        Nasıl Çalışır?
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        3 adımda kârlılığınızı ölçün ve daha doğru ticaret yapın.
                    </p>
                </div>

                <div className="relative grid gap-8 md:grid-cols-3">
                    {/* Connecting line for desktop */}
                    <div className="hidden md:block absolute top-8 left-[16%] right-[16%] h-0.5 bg-border -z-10" />

                    {steps.map((item) => (
                        <div key={item.step} className="relative flex flex-col items-center text-center group">
                            <div className="flex bg-background h-16 w-16 items-center justify-center rounded-2xl border-2 border-primary/20 bg-background text-2xl font-bold text-primary shadow-sm transition-all duration-300 group-hover:border-primary group-hover:scale-110 mb-6">
                                {item.step}
                            </div>
                            <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                            <p className="text-muted-foreground leading-relaxed max-w-xs">
                                {item.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
