'use client';

import { Navbar } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';

export default function PaymentFailPage() {
    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <div className="mx-auto max-w-lg px-4 py-24 text-center space-y-6">
                <XCircle className="h-16 w-16 text-red-500 mx-auto" />
                <h1 className="text-2xl font-bold text-red-600">Ödeme Başarısız ❌</h1>
                <p className="text-muted-foreground">
                    Ödeme tamamlanamadı. Lütfen tekrar deneyin veya farklı bir ödeme yöntemi kullanın.
                </p>
                <div className="flex gap-3 justify-center mt-4">
                    <Button
                        variant="outline"
                        onClick={() => window.location.href = '/pricing'}
                    >
                        Tekrar Dene
                    </Button>
                    <Button onClick={() => window.location.href = '/dashboard'}>
                        Dashboard'a Git
                    </Button>
                </div>
            </div>
        </div>
    );
}
