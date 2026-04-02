'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { AnalysisForm } from '@/components/analysis/analysis-form';

export default function NewAnalysisPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Yeni Analiz</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Urun bilgilerinizi girerek detayli kar analizi yapin.
          </p>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-6 sm:p-8">
          <AnalysisForm />
        </div>
      </div>
    </DashboardLayout>
  );
}
