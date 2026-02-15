'use client';

import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { isProUser } from '@/utils/access';

interface ProLockedSectionProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    blurAmount?: 'sm' | 'md' | 'lg' | 'xl';
    title?: string;
    description?: string;
    minHeight?: string;
}

export function ProLockedSection({
    children,
    fallback,
    blurAmount = 'md',
    title = "Bu Özelliği Açmak İçin Yükseltin",
    description = "Detaylı analizler ve ileri düzey özellikler için PRO plana geçin.",
    minHeight = "300px"
}: ProLockedSectionProps) {
    const { user } = useAuth();
    const router = useRouter();

    if (isProUser(user)) {
        return <>{children}</>;
    }

    // If user is free, show locked state
    const blurClass = {
        sm: 'blur-sm',
        md: 'blur-md',
        lg: 'blur-lg',
        xl: 'blur-xl',
    }[blurAmount];

    return (
        <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm" style={{ minHeight }}>
            {/* Blurred Content Background */}
            <div className={`absolute inset-0 p-6 opacity-50 pointer-events-none select-none ${blurClass}`}>
                {fallback || children}
            </div>

            {/* Lock Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] p-6 text-center z-10 transition-all hover:bg-background/50">
                <div className="rounded-full bg-primary/10 p-4 mb-4 shadow-sm animate-in zoom-in duration-300">
                    <Lock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold tracking-tight mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                    {description}
                </p>
                <Button
                    onClick={() => router.push('/pricing')}
                    className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all font-semibold"
                    size="lg"
                >
                    Pro'ya Yükselt
                </Button>
            </div>
        </div>
    );
}
