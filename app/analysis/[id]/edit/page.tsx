'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { AnalysisForm } from '@/components/analysis/analysis-form';
import { getAnalysisById } from '@/lib/storage';
import { Analysis } from '@/types';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function EditAnalysisPage() {
    const params = useParams();
    const id = params?.id as string;
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth');
            return;
        }

        if (user && id) {
            (async () => {
                const data = await getAnalysisById(id);
                if (data && data.userId === user.id) {
                    setAnalysis(data);
                }
                setLoading(false);
            })();
        }
    }, [user, id, authLoading, router]);

    if (loading || authLoading) {
        return (
            <DashboardLayout>
                <div className="flex h-[60vh] items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            </DashboardLayout>
        );
    }

    if (!analysis) {
        return (
            <DashboardLayout>
                <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
                    <p className="text-xl font-semibold">Analiz bulunamadi veya erisim yetkiniz yok.</p>
                    <Link href="/dashboard">
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Panele Don
                        </Button>
                    </Link>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="mx-auto max-w-4xl space-y-8">
                <div>
                    <Link href="/dashboard" className="mb-4 flex items-center text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="mr-1 h-3 w-3" /> Panele Don
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight">Analiz Duzenle</h1>
                    <p className="text-muted-foreground">
                        {analysis.input.product_name} isimli urunun analiz verilerini guncelleyin.
                    </p>
                </div>

                <div className="rounded-2xl border bg-card p-6 shadow-sm">
                    <AnalysisForm initialData={analysis.input} analysisId={analysis.id} />
                </div>
            </div>
        </DashboardLayout>
    );
}
