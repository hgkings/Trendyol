'use client';

import { useEffect, useState, useCallback } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function BasariPage() {
    const [status, setStatus] = useState<'checking' | 'active' | 'pending'>('checking');
    const [pollCount, setPollCount] = useState(0);

    const checkIsPro = useCallback(async (): Promise<boolean> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            const { data: profile } = await supabase
                .from('profiles')
                .select('is_pro, plan')
                .eq('id', user.id)
                .single();

            if (!profile) return false;

            // Check is_pro field first, fallback to plan field
            return profile.is_pro === true || profile.plan === 'pro';
        } catch {
            return false;
        }
    }, []);

    useEffect(() => {
        let attempt = 0;
        const maxAttempts = 60; // 5 dakika (5s x 60)
        let timeoutId: NodeJS.Timeout;

        const poll = async () => {
            attempt++;
            setPollCount(attempt);
            const isPro = await checkIsPro();

            if (isPro) {
                setStatus('active');
                return;
            }

            if (attempt < maxAttempts) {
                timeoutId = setTimeout(poll, 5000);
            } else {
                setStatus('pending');
            }
        };

        // İlk kontrolü 2 saniye sonra başlat
        timeoutId = setTimeout(poll, 2000);

        return () => clearTimeout(timeoutId);
    }, [checkIsPro]);

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <div className="mx-auto max-w-lg px-4 py-24 text-center space-y-6">

                {status === 'checking' && (
                    <>
                        <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto" />
                        <h1 className="text-2xl font-bold">Ödemeniz İşleniyor... 💳</h1>
                        <p className="text-muted-foreground">
                            Ödeme sayfasında işleminizi tamamladıysanız lütfen bekleyin.<br /><br />
                            Ödemeniz onaylandığında bu sayfa <b>otomatik</b> olarak güncellenecektir.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Kontrol ediliyor... ({pollCount})
                        </p>
                    </>
                )}

                {status === 'active' && (
                    <>
                        <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
                        <h1 className="text-2xl font-bold text-emerald-600">🎉 Pro Planınız Aktif!</h1>
                        <p className="text-muted-foreground">
                            Pro planınız başarıyla aktif edildi! Tüm özelliklere erişebilirsiniz.
                        </p>
                        <Button
                            className="mt-4"
                            onClick={() => window.location.href = '/dashboard'}
                        >
                            Dashboard&apos;a Git
                        </Button>
                    </>
                )}

                {status === 'pending' && (
                    <>
                        <Loader2 className="h-16 w-16 text-amber-500 mx-auto" />
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
                                    const isPro = await checkIsPro();
                                    setStatus(isPro ? 'active' : 'pending');
                                }}
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Tekrar Kontrol Et
                            </Button>
                            <Button onClick={() => window.location.href = '/dashboard'}>
                                Dashboard&apos;a Git
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
