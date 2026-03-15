'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { Loader2 } from 'lucide-react';

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
            <div className="mx-auto max-w-2xl px-4 py-8">
                <h1 className="mb-6 text-center text-xl font-semibold">Güvenli Ödeme</h1>
                <div className="overflow-hidden rounded-xl border shadow-sm">
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
