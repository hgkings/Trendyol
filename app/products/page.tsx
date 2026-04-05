'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
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
import { Upload, Download, Lock, Settings2, Loader2, Package } from 'lucide-react';
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

  // Trendyol stok verileri
  const [stockLoading, setStockLoading] = useState(false);
  const [stockData, setStockData] = useState<{
    totalProducts: number; totalStock: number; outOfStock: number; lowStock: number;
    products: Array<{
      id: string; title: string; barcode: string; stockCode: string;
      salePrice: number; listPrice: number; quantity: number;
      imageUrl: string | null; categoryName: string; brand: string;
      productUrl: string | null;
    }>;
  } | null>(null);

  const fetchStock = useCallback(async () => {
    setStockLoading(true);
    try {
      const res = await fetch('/api/marketplace/trendyol/stock');
      const data = await res.json();
      if (data.success) {
        setStockData(data);
      }
    } catch {
      // Stok çekilemezse sessizce devam et — bağlantı yoksa normal
    } finally {
      setStockLoading(false);
    }
  }, []);


  const isPro = isProUser(user);

  // Sayfa yüklendiğinde otomatik stok çek
  useEffect(() => {
    if (isPro) fetchStock();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro]);

  const handleDelete = async (id: string) => {
    const result = await deleteAnalysis(id);
    if (!result.success) {
      toast.error(`Silme işlemi başarısız: ${result.error}`);
      return;
    }

    toast.success('Ürün analizi silindi.');
    await refresh();
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!confirm(`${ids.length} ürün analizini silmek istediğinize emin misiniz?`)) return;
    let success = 0;
    for (const id of ids) {
      const result = await deleteAnalysis(id);
      if (result.success) success++;
    }
    toast.success(`${success} analiz silindi.`);
    await refresh();
  };

  const handleBulkExport = (ids: string[]) => {
    const selected = analyses.filter(a => ids.includes(a.id));
    if (selected.length === 0) return;
    try {
      const buffer = analysesToXLSX(selected);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `karnet_secili_${selected.length}_urun.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${selected.length} ürün Excel olarak indirildi.`);
    } catch {
      toast.error('Excel dosyası oluşturulamadı.');
    }
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
            {isPro && (
              <Button variant="outline" size="sm" onClick={fetchStock} disabled={stockLoading} className="whitespace-nowrap">
                {stockLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Package className="mr-1.5 h-4 w-4" />}
                {stockLoading ? 'Çekiliyor...' : 'Stok Güncelle'}
              </Button>
            )}
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

        <ProductsTable
          analyses={analyses}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          onBulkExport={handleBulkExport}
          stockMap={stockData ? (() => {
            const map = new Map<string, { barcode: string; quantity: number; salePrice: number; imageUrl: string | null; productUrl: string | null }>();
            for (const p of stockData.products) {
              const item = { barcode: p.barcode, quantity: p.quantity, salePrice: p.salePrice, imageUrl: p.imageUrl, productUrl: p.productUrl };
              if (p.barcode) map.set(p.barcode, item);
              if (p.stockCode && p.stockCode !== p.barcode) map.set(p.stockCode, item);
              if (p.title) {
                map.set(p.title.toLowerCase(), item);
                // Normalize: boşluk/tire temizle, sadece alfanümerik
                const norm = p.title.toLowerCase().replace(/[\s\-_./]+/g, '');
                if (norm) map.set(norm, item);
              }
              if (p.id) map.set(p.id, item);
            }
            return map;
          })() : undefined}
        />

      </div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </DashboardLayout>
  );
}
