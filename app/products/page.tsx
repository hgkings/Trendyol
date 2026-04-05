'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useAlerts } from '@/contexts/alert-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProductsTable } from '@/components/dashboard/products-table';
import { deleteAnalysis, bulkDeleteAnalyses, saveAnalysis, generateId } from '@/lib/api/analyses';
import { parseCSV, analysesToXLSX, analysesToJSON, exportCostTemplate, parseCostTemplate, exportBlankTemplate } from '@/lib/csv';
import { ProductInput } from '@/types';
import { calculateProfit } from '@/utils/calculations';
import { calculateRisk } from '@/utils/risk-engine';
import { UpgradeModal } from '@/components/shared/upgrade-modal';
import { Button } from '@/components/ui/button';
import { Upload, Download, Lock, Settings2, Loader2, Package, FileDown, FileUp, FilePlus2 } from 'lucide-react';
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
      monthlySales: number;
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
    if (!confirm('Bu analizi silmek istediğinize emin misiniz?')) return;
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
    const result = await bulkDeleteAnalyses(ids);
    if (result.success) {
      toast.success(`${result.deleted ?? ids.length} analiz silindi.`);
    } else {
      toast.error(result.error || 'Toplu silme başarısız.');
    }
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

  // ─── Aşama 1: Maliyet şablonu indir / yükle ───
  const costFileRef = useRef<HTMLInputElement>(null);

  const handleDownloadCostTemplate = () => {
    if (analyses.length === 0) return;
    try {
      const buffer = exportCostTemplate(analyses);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'karnet_maliyet_sablonu.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Maliyet şablonu indirildi. Düzenleyip geri yükleyin.');
    } catch {
      toast.error('Şablon oluşturulamadı.');
    }
  };

  const handleUploadCostTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      let buffer: ArrayBuffer;
      // CSV dosyası gelirse XLSX kütüphanesi ile uyumlu hale getir
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const encoder = new TextEncoder();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const XLSX = require('xlsx');
        const wb = XLSX.read(text, { type: 'string', FS: ';' });
        buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      } else {
        buffer = await file.arrayBuffer();
      }
      const updates = parseCostTemplate(buffer);
      if (updates.length === 0) {
        toast.error('Dosyada güncellenecek veri bulunamadı.');
        return;
      }

      const loadingToast = toast.loading(`${updates.length} ürün işleniyor...`);

      let updated = 0;
      let created = 0;

      for (const { id, isNew, updates: fields } of updates) {
        if (!isNew && id) {
          // Mevcut ürün güncelleme
          const existing = analyses.find(a => a.id === id);
          if (!existing) continue;
          const updatedInput: ProductInput = { ...existing.input, ...fields };
          const result = calculateProfit(updatedInput);
          const risk = calculateRisk(updatedInput, result);
          const res = await saveAnalysis({ ...existing, input: updatedInput, result, risk });
          if (res.success) updated++;
        } else if (isNew && fields.product_name) {
          // Yeni ürün oluşturma
          if (!user) continue;
          const newInput: ProductInput = {
            marketplace: fields.marketplace ?? 'trendyol',
            product_name: fields.product_name,
            monthly_sales_volume: fields.monthly_sales_volume ?? 100,
            product_cost: fields.product_cost ?? 0,
            sale_price: fields.sale_price ?? 0,
            commission_pct: fields.commission_pct ?? 18,
            shipping_cost: fields.shipping_cost ?? 0,
            packaging_cost: fields.packaging_cost ?? 0,
            ad_cost_per_sale: fields.ad_cost_per_sale ?? 0,
            return_rate_pct: fields.return_rate_pct ?? 12,
            vat_pct: fields.vat_pct ?? 20,
            other_cost: fields.other_cost ?? 0,
            payout_delay_days: 28,
          };
          const result = calculateProfit(newInput);
          const risk = calculateRisk(newInput, result);
          const res = await saveAnalysis({
            id: generateId(),
            userId: user.id,
            input: newInput,
            result,
            risk,
            createdAt: new Date().toISOString(),
          });
          if (res.success) created++;
        }
      }

      toast.dismiss(loadingToast);
      const parts: string[] = [];
      if (updated > 0) parts.push(`${updated} ürün güncellendi`);
      if (created > 0) parts.push(`${created} yeni ürün eklendi`);
      toast.success(parts.join(', ') || 'İşlem tamamlandı.');
      await refresh();
    } catch {
      toast.error('Dosya okunamadı veya format hatalı.');
    }
  };

  // ─── Aşama 2: Boş şablon indir ───
  const handleDownloadBlankTemplate = () => {
    try {
      const buffer = exportBlankTemplate();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'karnet_yeni_urun_sablonu.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Yeni ürün şablonu indirildi.');
    } catch {
      toast.error('Şablon oluşturulamadı.');
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
<Button variant="outline" size="sm" onClick={handleExportXLSX} disabled={analyses.length === 0} className="whitespace-nowrap">
              <Download className="mr-1.5 h-4 w-4" />
              {isPro ? 'Excel' : 'Excel (Pro)'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBulkUpdate(true)} disabled={analyses.length === 0} className="whitespace-nowrap">
              <Settings2 className="mr-1.5 h-4 w-4" />
              Toplu Güncelle
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadCostTemplate} disabled={analyses.length === 0} className="whitespace-nowrap">
              <FileDown className="mr-1.5 h-4 w-4" />
              Maliyetleri Indir
            </Button>
            <Button variant="outline" size="sm" onClick={() => costFileRef.current?.click()} disabled={analyses.length === 0} className="whitespace-nowrap">
              <FileUp className="mr-1.5 h-4 w-4" />
              Maliyetleri Yukle
            </Button>
            <input ref={costFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUploadCostTemplate} />
            <Button variant="outline" size="sm" onClick={handleDownloadBlankTemplate} className="whitespace-nowrap">
              <FilePlus2 className="mr-1.5 h-4 w-4" />
              Bos Sablon
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
            const map = new Map<string, { barcode: string; quantity: number; salePrice: number; imageUrl: string | null; productUrl: string | null; monthlySales: number }>();
            for (const p of stockData.products) {
              const item = { barcode: p.barcode, quantity: p.quantity, salePrice: p.salePrice, imageUrl: p.imageUrl, productUrl: p.productUrl, monthlySales: p.monthlySales ?? 0 };
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
