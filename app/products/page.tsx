'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useAlerts } from '@/contexts/alert-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProductsTable } from '@/components/dashboard/products-table';
import { deleteAnalysis, saveAnalysis, generateId } from '@/lib/api/analyses';
import { parseCSV, analysesToXLSX, analysesToJSON } from '@/lib/csv';
import { ProductInput } from '@/types';
import { calculateProfit } from '@/utils/calculations';
import { calculateRisk } from '@/utils/risk-engine';
import { UpgradeModal } from '@/components/shared/upgrade-modal';
import { Button } from '@/components/ui/button';
import { Upload, Download, Lock, Settings2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { BulkUpdateModal } from '@/components/dashboard/bulk-update-modal';
import { CSVImportSection } from '@/components/dashboard/csv-import-section';
import { toast } from 'sonner';
import { isProUser } from '@/utils/access';

export default function ProductsPage() {
  const { user } = useAuth();
  const { analyses, loading, refresh } = useAlerts();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);

  const isPro = isProUser(user);

  const handleDelete = async (id: string) => {
    const result = await deleteAnalysis(id);
    if (!result.success) {
      toast.error(`Silme işlemi başarısız: ${result.error}`);
      return;
    }

    toast.success('Ürün analizi silindi.');
    await refresh();
  };

  const performImport = async (data: ProductInput[]) => {
    if (!user) return;

    if (!isPro && analyses.length + data.length > 5) {
      setShowUpgrade(true);
      toast.error('Ücretsiz planda en fazla 5 analiz yapabilirsiniz. Toplu yükleme için Pro plana geçmelisiniz.');
      return;
    }

    toast.info(`${data.length} ürün yükleniyor...`);
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
    toast.success('İçe aktarma tamamlandı.');
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

  const handleExportXLSX = () => {
    if (analyses.length === 0 || !isPro) {
      if (!isPro) setShowUpgrade(true);
      return;
    }
    try {
      const buffer = analysesToXLSX(analyses);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'karnet_urunler.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel dosyası indirildi');
    } catch {
      toast.error('Excel dosyası oluşturulamadı');
    }
  };

  if (loading && analyses.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Ürünler yükleniyor...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Ürünler</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {analyses.length} ürün analizi{!isPro && ` (Ücretsiz: maks 5)`}
              </p>
            </div>
            <Link href="/analysis/new" className="w-full sm:w-auto">
              <Button size="sm" className="w-full sm:w-auto">Yeni Analiz</Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            <Button variant="outline" size="sm" onClick={handleExportJSON} disabled={analyses.length === 0} className="whitespace-nowrap">
              <Download className="mr-1.5 h-4 w-4" />
              JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportXLSX} disabled={analyses.length === 0} className="whitespace-nowrap">
              <Download className="mr-1.5 h-4 w-4" />
              {isPro ? 'Excel' : 'Excel (Pro)'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBulkUpdate(true)} disabled={analyses.length === 0} className="whitespace-nowrap">
              <Settings2 className="mr-1.5 h-4 w-4" />
              Toplu Güncelle
            </Button>
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
