'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useAlerts } from '@/contexts/alert-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProductsTable } from '@/components/dashboard/products-table';
import { deleteAnalysis, saveAnalysis, generateId } from '@/lib/storage';
import { parseCSV, analysesToCSV, analysesToJSON } from '@/lib/csv';
import { calculateProfit } from '@/utils/calculations';
import { calculateRisk } from '@/utils/risk-engine';
import { UpgradeModal } from '@/components/shared/upgrade-modal';
import { Button } from '@/components/ui/button';
import { Upload, Download, Lock, Settings2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { BulkUpdateModal } from '@/components/dashboard/bulk-update-modal';
import { CSVImportSection } from '@/components/dashboard/csv-import-section';
import { toast } from 'sonner';

export default function ProductsPage() {
  const { user } = useAuth();
  const { analyses, loading, refresh } = useAlerts();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);

  const isPro = user?.plan === 'pro';

  const handleDelete = async (id: string) => {
    const result = await deleteAnalysis(id);
    if (!result.success) {
      toast.error(`Silme islemi basarisiz: ${result.error}`);
      return;
    }

    toast.success('Urun analizi silindi.');
    await refresh();
  };

  const performImport = async (data: any[]) => {
    if (!user) return;

    if (!isPro && analyses.length + data.length > 5) {
      setShowUpgrade(true);
      toast.error('Ucretsiz planda en fazla 5 analiz yapabilirsiniz. Toplu yukleme icin Pro plana gecmelisiniz.');
      return;
    }

    toast.info(`${data.length} urun yukleniyor...`);
    for (const input of data) {
      const result = calculateProfit(input);
      const risk = calculateRisk(input, result);
      await saveAnalysis({
        id: generateId(),
        userId: user.id,
        input,
        result,
        risk,
        createdAt: new Date().toISOString(),
      });
    }
    toast.success('Import tamamlandi.');
    await refresh();
  };

  const handleExportJSON = () => {
    if (analyses.length === 0) return;
    const json = analysesToJSON(analyses);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'urunler.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (analyses.length === 0 || !isPro) {
      if (!isPro) setShowUpgrade(true);
      return;
    }
    const csv = analysesToCSV(analyses);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'urunler.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && analyses.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Urunler yukleniyor...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Urunler</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {analyses.length} urun analizi{!isPro && ` (Ucretsiz: maks 5)`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportJSON} disabled={analyses.length === 0}>
              <Download className="mr-1.5 h-4 w-4" />
              JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={analyses.length === 0}>
              <Download className="mr-1.5 h-4 w-4" />
              {isPro ? 'CSV' : 'CSV (Pro)'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBulkUpdate(true)} disabled={analyses.length === 0}>
              <Settings2 className="mr-1.5 h-4 w-4" />
              Toplu Guncelle
            </Button>
            <Link href="/analysis/new">
              <Button size="sm">Yeni Analiz</Button>
            </Link>
          </div>
        </div>

        <CSVImportSection onImport={performImport} />

        <BulkUpdateModal
          open={showBulkUpdate}
          onOpenChange={setShowBulkUpdate}
          analyses={analyses}
          onComplete={refresh}
        />

        <ProductsTable analyses={analyses} onDelete={handleDelete} />
      </div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </DashboardLayout>
  );
}
