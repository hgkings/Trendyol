
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Clock, Timer, AlertTriangle, TrendingUp, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

export function Hero() {
    const { user } = useAuth();

    return (
        <section className="relative overflow-hidden pt-32 pb-20 lg:pt-44 lg:pb-28">
            {/* Background */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background" />
            <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary/8 blur-[120px]" />
            <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-purple-500/8 blur-[100px]" />

            <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                    {/* Left Content */}
                    <div className="max-w-2xl text-center lg:text-left">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card/60 px-3.5 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-sm shadow-premium-sm">
                            <TrendingUp className="h-3.5 w-3.5 text-primary" />
                            <span>Pazaryeri Kâr Analiz Aracı</span>
                        </div>

                        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1] mb-6">
                            Pazaryerinde gerçekten{' '}
                            <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                                kâr ediyor musun?
                            </span>
                        </h1>

                        <p className="mb-8 text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
                            Komisyon, kargo, reklam, iade, KDV dahil — net kâr ve risk puanı.
                            Ürün başı gerçek kârını 2 dakikada gör.
                        </p>

                        {/* Trust Chips */}
                        <div className="flex flex-wrap gap-3 mb-10 justify-center lg:justify-start">
                            {[
                                { icon: Clock, text: '1–3 dk / ürün analiz' },
                                { icon: Timer, text: '10–50+ saat / ay tasarruf' },
                                { icon: AlertTriangle, text: 'Zarar eden ürünleri erken tespit' },
                            ].map((item) => (
                                <div
                                    key={item.text}
                                    className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3.5 py-2 text-sm text-muted-foreground backdrop-blur-sm shadow-premium-sm"
                                >
                                    <item.icon className="h-3.5 w-3.5 text-primary" />
                                    <span className="font-medium">{item.text}</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                            <Link href="/demo">
                                <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base gap-2 rounded-[10px] shadow-premium-md hover:shadow-premium-lg transition-all">
                                    Ücretsiz Demo
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                            <Link href={user ? '/dashboard' : '/auth'}>
                                <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 text-base rounded-[10px] hover:bg-muted/50">
                                    Panele Git
                                </Button>
                            </Link>
                        </div>

                        <p className="mt-4 text-sm text-muted-foreground">
                            Kredi kartı gerekmez · Ücretsiz plan mevcuttur
                        </p>
                    </div>

                    {/* Right Visual (Desktop Only) */}
                    <div className="hidden lg:block relative h-[480px] w-full">
                        {/* Card 1: Profit */}
                        <div className="absolute top-8 right-8 w-64 rounded-2xl border bg-card/70 p-5 backdrop-blur-xl shadow-premium-md animate-float">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Aylık Tahmini Net Kâr</p>
                                    <p className="text-lg font-bold text-foreground">₺48.250</p>
                                </div>
                            </div>
                            <div className="h-1.5 w-full bg-emerald-500/10 rounded-full overflow-hidden">
                                <div className="h-full w-[72%] bg-emerald-500 rounded-full" />
                            </div>
                        </div>

                        {/* Card 2: Risk */}
                        <div className="absolute top-44 left-4 w-60 rounded-2xl border bg-card/70 p-4 backdrop-blur-xl shadow-premium-md animate-float" style={{ animationDelay: '1.2s' }}>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                </div>
                                <p className="text-sm font-semibold text-red-600 dark:text-red-400">Risk Uyarısı</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                "Kulaklık" ürününde %3.2 marj. Kritik seviye.
                            </p>
                        </div>

                        {/* Card 3: Report */}
                        <div className="absolute bottom-16 right-16 w-56 rounded-2xl border bg-card/70 p-4 backdrop-blur-xl shadow-premium-md animate-float" style={{ animationDelay: '2.4s' }}>
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <FileText className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">Rapor Hazır</p>
                                    <p className="text-[11px] text-muted-foreground">PDF olarak indirildi.</p>
                                </div>
                            </div>
                        </div>

                        {/* Decorative */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-primary/15 rounded-full blur-[120px] -z-10" />
                    </div>
                </div>
            </div>
        </section>
    );
}
