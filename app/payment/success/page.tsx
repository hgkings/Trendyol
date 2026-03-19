'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, RefreshCw, LayoutDashboard } from 'lucide-react';

function PaymentSuccessContent() {
    const searchParams = useSearchParams();
    const paymentId = searchParams.get('paymentId');

    const [status, setStatus] = useState<'checking' | 'active' | 'pending'>('checking');
    const [pollCount, setPollCount] = useState(0);

    const checkProfile = useCallback(async (): Promise<boolean> => {
        try {
            const res = await fetch('/api/user/profile', { credentials: 'same-origin', cache: 'no-store' });
            if (!res.ok) return false;
            const data = await res.json();
            return data?.plan === 'pro' || String(data?.plan || '').startsWith('pro_');
        } catch {
            return false;
        }
    }, []);

    useEffect(() => {
        let attempt = 0;
        const maxAttempts = 120;

        const poll = async () => {
            attempt++;
            setPollCount(attempt);
            const isPro = await checkProfile();

            if (isPro) {
                setStatus('active');
                return;
            }

            if (attempt < maxAttempts) {
                setTimeout(poll, 5000);
            } else {
                setStatus('pending');
            }
        };

        setTimeout(poll, 2000);
    }, [checkProfile]);

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <div className="mx-auto max-w-lg px-4 py-24 text-center space-y-6">

                {status === 'checking' && (
                    <>
                        <div className="flex justify-center">
                            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold">Ödemenizi Tamamlayın 💳</h1>
                        <p className="text-muted-foreground leading-relaxed">
                            Ödeme sayfası güvenli bir şekilde yeni sekmede açıldı.<br /><br />
                            Lütfen işlemi orada tamamlayın. Ödemeniz bittiğinde bu sayfa <b>otomatik</b> olarak onaylanacaktır...
                        </p>
                        <p className="text-xs text-muted-foreground">Kontrol: {pollCount} / 120</p>
                    </>
                )}

                {status === 'active' && (
                    <>
                        <div className="flex justify-center">
                            <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">Pro Plan Aktif! 🎉</h1>
                        <p className="text-muted-foreground">
                            Tebrikler! Pro planınız başarıyla aktif edildi.
                        </p>
                        <Button
                            className="mt-4 gap-2"
                            onClick={() => window.location.href = '/dashboard'}
                        >
                            <LayoutDashboard className="h-4 w-4" />
                            Dashboard&apos;a Git
                        </Button>
                    </>
                )}

                {status === 'pending' && (
                    <>
                        <div className="flex justify-center">
                            <div className="h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                                <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">Ödeme Bekleniyor ⏳</h1>
                        <p className="text-muted-foreground">
                            Ödeme işleminiz henüz bize ulaşmadı. Eğer ödemeyi tamamladıysanız biraz daha bekleyip tekrar kontrol edebilirsiniz.
                        </p>
                        <div className="flex gap-3 justify-center mt-4">
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={async () => {
                                    setStatus('checking');
                                    setPollCount(0);
                                    const isPro = await checkProfile();
                                    setStatus(isPro ? 'active' : 'pending');
                                }}
                            >
                                <RefreshCw className="h-4 w-4" />
                                Tekrar Kontrol Et
                            </Button>
                            <Button
                                className="gap-2"
                                onClick={() => window.location.href = '/dashboard'}
                            >
                                <LayoutDashboard className="h-4 w-4" />
                                Dashboard&apos;a Git
                            </Button>
                        </div>
                    </>
                )}

                {paymentId && (
                    <p className="text-xs text-muted-foreground mt-8">
                        Sipariş No: {paymentId.substring(0, 8)}...
                    </p>
                )}
            </div>
        </div>
    );
}

export default function PaymentSuccessPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <PaymentSuccessContent />
        </Suspense>
    );
}
