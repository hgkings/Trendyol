'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-muted/20 p-4 text-center">
            <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/30">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold">Bir şeyler ters gitti!</h2>
            <p className="max-w-md text-sm text-muted-foreground">
                Uygulama çalışırken beklenmedik bir hata oluştu. Bu durum genellikle geçicidir veya tarayıcı eklentilerinden kaynaklanabilir.
            </p>

            {/* Dev Info Suggestion */}
            {process.env.NODE_ENV === 'development' && (
                <div className="mt-2 rounded bg-muted p-2 text-xs text-left max-w-lg overflow-auto">
                    <p className="font-mono text-red-500 mb-1">{error.name}: {error.message}</p>
                    <p className="text-muted-foreground">Eğer bu hata MetaMask veya başka bir eklentiden kaynaklanıyorsa, lütfen eklentiyi devre dışı bırakmayı deneyin.</p>
                </div>
            )}

            <Button onClick={() => reset()} className="mt-4 gap-2">
                <RefreshCcw className="h-4 w-4" />
                Tekrar Dene
            </Button>
        </div>
    );
}
