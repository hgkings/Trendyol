'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

export default function PaymentSuccessPage() {
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
                        <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto" />
                        <h1 className="text-2xl font-bold">Ödemenizi Tamamlayın 💳</h1>
                        <p className="text-muted-foreground">
                            Ödeme sayfası güvenli bir şekilde yeni sekmede açıldı.<br /><br />
                            Lütfen işlemi orada tamamlayın. Ödemeniz bittiğinde bu sayfa <b>otomatik</b> olarak onaylanacaktır...
                        </p>
                    </>
                )}

                {status === 'active' && (
                    <>
                        <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
                        <h1 className="text-2xl font-bold text-emerald-600">Pro Plan Aktif! 🎉</h1>
                        <p className="text-muted-foreground">
                            Tebrikler! Pro planınız başarıyla aktif edildi.
                        </p>
                        <Button
                            className="mt-4"
                            onClick={() => window.location.href = '/dashboard'}
                        >
                            Dashboard'a Git
                        </Button>
                    </>
                )}

                {status === 'pending' && (
                    <>
                        <Loader2 className="h-16 w-16 text-amber-500 animate-spin mx-auto" />
                        <h1 className="text-2xl font-bold text-amber-600">Ödeme Bekleniyor ⏳</h1>
                        <p className="text-muted-foreground">
                            Ödeme işleminiz henüz bize ulaşmadı. Eğer ödemeyi tamamladıysanız biraz daha bekleyip tekrar kontrol edebilirsiniz.
                        </p>
                        <div className="flex gap-3 justify-center mt-4">
                            <Button
                                variant="outline"
                                onClick={async () => {
                                    setStatus('checking');
                                    setPollCount(0);
                                    const isPro = await checkProfile();
                                    setStatus(isPro ? 'active' : 'pending');
                                }}
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Tekrar Kontrol Et
                            </Button>
                            <Button onClick={() => window.location.href = '/dashboard'}>
                                Dashboard'a Git
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
