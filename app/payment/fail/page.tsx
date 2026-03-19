'use client';

import { Navbar } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { XCircle, LayoutDashboard, RotateCcw } from 'lucide-react';

export default function PaymentFailPage() {
    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <div className="mx-auto max-w-lg px-4 py-24 text-center space-y-6">
                <div className="flex justify-center">
                    <div className="h-20 w-20 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                        <XCircle className="h-10 w-10 text-red-500" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Ödeme Başarısız ❌</h1>
                <p className="text-muted-foreground">
                    Ödeme tamamlanamadı. Lütfen tekrar deneyin veya farklı bir ödeme yöntemi kullanın.
                </p>
                <div className="flex gap-3 justify-center mt-4">
                    <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => window.location.href = '/pricing'}
                    >
                        <RotateCcw className="h-4 w-4" />
                        Tekrar Dene
                    </Button>
                    <Button
                        className="gap-2"
                        onClick={() => window.location.href = '/dashboard'}
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard&apos;a Git
                    </Button>
                </div>
            </div>
        </div>
    );
}
