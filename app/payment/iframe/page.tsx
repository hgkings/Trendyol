'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { Loader2, ShieldCheck } from 'lucide-react';

function IFrameContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    if (!token) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p className="text-muted-foreground">Geçersiz ödeme oturumu.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <div className="mx-auto max-w-2xl px-4 py-10">
                {/* Header */}
                <div className="mb-6 text-center space-y-2">
                    <div className="inline-flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <ShieldCheck className="h-4 w-4" />
                        <span className="text-sm font-medium">Güvenli Ödeme</span>
                    </div>
                    <h1 className="text-xl font-semibold">Ödemenizi Tamamlayın</h1>
                </div>

                {/* iframe */}
                <div className="overflow-hidden rounded-2xl border border-border shadow-lg bg-card">
                    <iframe
                        src={`https://www.paytr.com/odeme/frame/${token}`}
                        width="100%"
                        height="600px"
                        frameBorder="0"
                        scrolling="no"
                        style={{ display: 'block' }}
                    />
                </div>

                <p className="mt-4 text-center text-xs text-muted-foreground">
                    Güvenli ödeme PayTR altyapısı ile gerçekleştirilir. Kart bilgileriniz tarafımızca saklanmaz.
                </p>
            </div>
        </div>
    );
}

export default function PaymentIframePage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <IFrameContent />
        </Suspense>
    );
}
