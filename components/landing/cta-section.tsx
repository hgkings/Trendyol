
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrendingUp, ShieldCheck, FileText, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

export function CTASection() {
    const { user } = useAuth();

    return (
        <section className="py-24 px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl relative overflow-hidden rounded-3xl bg-primary text-primary-foreground px-6 py-16 sm:px-12 sm:py-20 text-center shadow-premium-lg">
                {/* Background pattern */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/15 via-transparent to-transparent" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />

                <div className="relative z-10">
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl mb-4">
                        2 dakikada gerçek kârını öğren
                    </h2>
                    <p className="mx-auto mt-2 max-w-2xl text-lg text-primary-foreground/80 mb-10">
                        Ücretsiz plan ile hemen 5 ürüne kadar analiz yap. Hiçbir kurulum gerekmez.
                    </p>

                    {/* Trust badges */}
                    <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
                        {[
                            { icon: Lock, text: 'Kart bilgisi gerekmez' },
                            { icon: FileText, text: 'PDF rapor alın' },
                            { icon: ShieldCheck, text: 'Veriler sadece sende' },
                        ].map((badge) => (
                            <div
                                key={badge.text}
                                className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-2 text-sm font-medium text-primary-foreground/90"
                            >
                                <badge.icon className="h-4 w-4" />
                                {badge.text}
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href={user ? '/analysis/new' : '/auth'}>
                            <Button size="lg" variant="secondary" className="h-14 px-8 text-lg font-semibold shadow-premium-md hover:shadow-premium-lg transition-all gap-2 text-primary rounded-[10px]">
                                <TrendingUp className="h-5 w-5" />
                                Ücretsiz Başla
                            </Button>
                        </Link>
                        <Link href="/pricing">
                            <Button size="lg" variant="outline" className="h-14 px-8 text-lg bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 rounded-[10px]">
                                Planları İncele
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
