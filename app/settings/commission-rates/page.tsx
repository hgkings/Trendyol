'use client';

import { useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { upsertCommissionRates } from '@/lib/commission-rates';
import { MARKETPLACE_CATEGORIES } from '@/lib/commission-categories';
import { toast } from 'sonner';
import { Upload, Download, Link2, AlertTriangle, CheckCircle2, ArrowLeft, Info } from 'lucide-react';
import NextLink from 'next/link';
import { Marketplace } from '@/types';

interface ParsedRate {
  marketplace: string;
  category: string;
  rate: number;
}

function parseCSV(csv: string): { rates: ParsedRate[]; errors: string[] } {
  const lines = csv.trim().split('\n').filter((l) => l.trim());
  const rates: ParsedRate[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r/g, '');
    // Support both comma and semicolon separators
    const parts = line.split(/[,;]/).map((p) => p.trim().replace(/^["']|["']$/g, ''));
    if (parts.length < 3) {
      errors.push(`Satır ${i + 1}: Eksik sütun — "${line}"`);
      continue;
    }
    const [marketplace, category, rateStr] = parts;
    const rate = parseFloat(rateStr.replace(',', '.'));
    if (!marketplace || !category) {
      errors.push(`Satır ${i + 1}: Pazaryeri veya kategori boş`);
      continue;
    }
    if (isNaN(rate) || rate < 0 || rate > 100) {
      errors.push(`Satır ${i + 1}: Geçersiz oran "${rateStr}" (0-100 arası olmalı)`);
      continue;
    }
    rates.push({ marketplace: marketplace.toLowerCase().replace(' ', '_'), category, rate });
  }

  return { rates, errors };
}

function generateTemplateCSV(): string {
  const lines: string[] = ['Pazaryeri,Kategori,Komisyon Oranı (%)'];
  const MARKETPLACE_LABELS: Record<Marketplace, string> = {
    trendyol: 'Trendyol',
    hepsiburada: 'Hepsiburada',
    n11: 'n11',
    amazon_tr: 'Amazon TR',
    custom: 'Custom',
  };
  for (const [key, cats] of Object.entries(MARKETPLACE_CATEGORIES)) {
    const label = MARKETPLACE_LABELS[key as Marketplace] || key;
    for (const cat of cats) {
      lines.push(`${label},${cat.label},${cat.commission_pct}`);
    }
  }
  return lines.join('\n');
}

export default function CommissionRatesPage() {
  const { user } = useAuth();
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParsedRate[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSheetsImport = async () => {
    if (!sheetsUrl.trim()) {
      toast.error('Lütfen bir Google Sheets URL\'i girin.');
      return;
    }
    setImporting(true);
    setPreview(null);
    setParseErrors([]);
    try {
      const res = await fetch('/api/commission-rates/import-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetsUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Sheets okunamadı.');
        return;
      }
      const { rates, errors } = parseCSV(data.csv);
      setPreview(rates);
      setParseErrors(errors);
      if (rates.length > 0) {
        toast.success(`${rates.length} oran okundu. Kaydet butonuna basarak uygulayın.`);
      } else {
        toast.error('Hiç geçerli satır bulunamadı.');
      }
    } finally {
      setImporting(false);
    }
  };

  const handleCSVUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csv = ev.target?.result as string;
      const { rates, errors } = parseCSV(csv);
      setPreview(rates);
      setParseErrors(errors);
      if (rates.length > 0) {
        toast.success(`${rates.length} oran okundu. Kaydet butonuna basarak uygulayın.`);
      } else {
        toast.error('Hiç geçerli satır bulunamadı.');
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  }, []);

  const handleSave = async () => {
    if (!user || !preview || preview.length === 0) return;
    setSaving(true);
    try {
      const result = await upsertCommissionRates(user.id, preview);
      if (result.success) {
        toast.success(`${preview.length} komisyon oranı kaydedildi.`);
        setPreview(null);
        setParseErrors([]);
        setSheetsUrl('');
      } else {
        toast.error(`Kayıt hatası: ${result.error}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateDownload = () => {
    const csv = generateTemplateCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'komisyon-oranlari-sablon.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const MARKETPLACE_HELP_LINKS = [
    {
      name: 'Trendyol',
      url: 'https://akademi.trendyol.com/satici-bilgi-merkezi/detay/trendyol-komisyonlari',
    },
    {
      name: 'Hepsiburada',
      url: 'https://merchant.hepsiburada.com',
      note: '→ Yardım → Komisyon Oranları',
    },
    { name: 'n11', url: 'https://magazadestek.n11.com/s/komisyon-oranlari' },
    { name: 'Amazon TR', url: 'https://sellercentral.amazon.com.tr' },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8 py-2">
        {/* Header */}
        <div className="flex items-center gap-3">
          <NextLink href="/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </NextLink>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Komisyon Oranlarını Güncelle</h1>
            <p className="text-sm text-muted-foreground">
              Google Sheets veya CSV ile kendi komisyon oranlarınızı içe aktarın.
            </p>
          </div>
        </div>

        {/* Where to find rates */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Varsayılan oranlar genel tahmindir
            </span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Gerçek komisyon oranlarınız için satıcı panellerinizi kontrol edin:
          </p>
          <ul className="space-y-1.5">
            {MARKETPLACE_HELP_LINKS.map((link) => (
              <li key={link.name} className="text-xs">
                <span className="font-semibold text-amber-800 dark:text-amber-300">{link.name}:</span>{' '}
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:no-underline"
                >
                  {link.url}
                </a>
                {link.note && (
                  <span className="text-amber-600 dark:text-amber-500"> {link.note}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Expected Format */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Beklenen Format (CSV / Sheets)</h2>
            <Button variant="outline" size="sm" onClick={handleTemplateDownload}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Şablonu İndir
            </Button>
          </div>
          <div className="rounded-lg bg-muted p-4 font-mono text-xs space-y-1">
            <p className="text-muted-foreground">Sütun A: Pazaryeri | Sütun B: Kategori | Sütun C: Oran (%)</p>
            <div className="border-t pt-2 mt-2 space-y-0.5">
              <p>Trendyol,Giyim &amp; Moda,20</p>
              <p>Trendyol,Elektronik,8</p>
              <p>Hepsiburada,Giyim &amp; Moda,16</p>
              <p>n11,Elektronik,8</p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              Virgül veya noktalı virgül ayraç olarak kullanılabilir. İlk satır başlık ise otomatik atlanır.
              Pazaryeri adları: <code className="bg-muted px-1 rounded">Trendyol</code>,{' '}
              <code className="bg-muted px-1 rounded">Hepsiburada</code>,{' '}
              <code className="bg-muted px-1 rounded">n11</code>,{' '}
              <code className="bg-muted px-1 rounded">Amazon TR</code>
            </p>
          </div>
        </div>

        {/* Google Sheets Import */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Google Sheets ile İçe Aktar</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Sheets dosyasını <strong>Herkes (bağlantıya sahip olanlar)</strong> olarak paylaşmanız gerekir.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSheetsImport} disabled={importing || !sheetsUrl.trim()}>
              {importing ? 'Okunuyor...' : 'Bağlan ve İçe Aktar'}
            </Button>
          </div>
        </div>

        {/* CSV Upload */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">CSV Dosyası Yükle</h2>
          </div>
          <Label
            htmlFor="csv-upload"
            className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-muted/30 transition-colors"
          >
            <Upload className="h-5 w-5 text-muted-foreground mb-1" />
            <span className="text-xs text-muted-foreground">CSV dosyasını buraya sürükleyin veya tıklayın</span>
          </Label>
          <input
            id="csv-upload"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCSVUpload}
          />
        </div>

        {/* Parse Errors */}
        {parseErrors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 p-4 space-y-2">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400">
              {parseErrors.length} satırda hata:
            </p>
            <ul className="space-y-0.5">
              {parseErrors.map((e, i) => (
                <li key={i} className="text-xs text-red-600 dark:text-red-400">{e}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview */}
        {preview && preview.length > 0 && (
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <h2 className="font-semibold text-sm">Önizleme — {preview.length} oran</h2>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Pazaryeri</th>
                    <th className="text-left px-3 py-2">Kategori</th>
                    <th className="text-right px-3 py-2">Oran</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5">{r.marketplace}</td>
                      <td className="px-3 py-1.5">{r.category}</td>
                      <td className="px-3 py-1.5 text-right font-mono">%{r.rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
