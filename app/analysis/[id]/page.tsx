'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Analysis } from '@/types';
import { getAnalysisById } from '@/lib/storage';
import { useAuth } from '@/contexts/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RiskGauge } from '@/components/shared/risk-gauge';
import { RiskBadge } from '@/components/shared/risk-badge';
import { CostBreakdown } from '@/components/analysis/cost-breakdown';
import { SensitivityTable } from '@/components/analysis/sensitivity-table';
import { MarketplaceComparison } from '@/components/analysis/marketplace-comparison';
import { CashflowEstimator } from '@/components/analysis/cashflow-estimator';
import { formatCurrency, formatPercent } from '@/components/shared/format';
import { getMarketplaceLabel } from '@/lib/marketplace-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Download,
  Lock,
  AlertTriangle,
  Target,
  User2,
  TrendingUp,
  ChevronRight,
  Save,
  Rocket
} from 'lucide-react';
import { saveAnalysis } from '@/lib/storage';
import { calculateProfit } from '@/utils/calculations';
import { calculateRisk } from '@/utils/risk-engine';
import { toast } from 'sonner';
import { analysesToJSON, analysesToCSV } from '@/lib/csv';

export default function AnalysisResultPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Competitor states
  const [compName, setCompName] = useState('');
  const [compPrice, setCompPrice] = useState<number>(0);
  const [targetPos, setTargetPos] = useState<'cheaper' | 'same' | 'premium'>('same');

  useEffect(() => {
    (async () => {
      const id = params.id as string;
      const found = await getAnalysisById(id);
      if (found) {
        setAnalysis(found);
        setCompName(found.input.competitor_name || '');
        setCompPrice(found.input.competitor_price || 0);
        setTargetPos(found.input.target_position || 'same');
      }
      setLoading(false);
    })();
  }, [params.id]);

  const handleSaveCompetitor = async () => {
    if (!analysis) return;
    setSaving(true);
    try {
      const updatedInput = {
        ...analysis.input,
        competitor_name: compName,
        competitor_price: compPrice,
        target_position: targetPos,
      };
      const res = await saveAnalysis({ ...analysis, input: updatedInput });
      if (res.success) {
        setAnalysis({ ...analysis, input: updatedInput });
        toast.success('Rakip bilgileri kaydedildi.');
      }
    } catch (e) {
      toast.error('Hata olustu.');
    } finally {
      setSaving(false);
    }
  };

  const handleApplySuggestedPrice = async (price: number) => {
    if (!analysis) return;
    setSaving(true);
    try {
      const updatedInput = { ...analysis.input, sale_price: price };
      const updatedResult = calculateProfit(updatedInput);
      const updatedRisk = calculateRisk(updatedInput, updatedResult);

      const updatedAnalysis = {
        ...analysis,
        input: updatedInput,
        result: updatedResult,
        risk: updatedRisk
      };

      const res = await saveAnalysis(updatedAnalysis);
      if (res.success) {
        setAnalysis(updatedAnalysis);
        toast.success('Fiyat guncellendi ve yeniden hesaplandi.');
      }
    } catch (e) {
      toast.error('Hata olustu.');
    } finally {
      setSaving(false);
    }
  };

  const isPro = user?.plan === 'pro';

  const handleExportJSON = () => {
    if (!analysis) return;
    const json = analysesToJSON([analysis]);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysis.input.product_name}-analiz.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!analysis || !isPro) return;
    const csv = analysesToCSV([analysis]);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysis.input.product_name}-analiz.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!analysis) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center">
          <p className="text-muted-foreground">Analiz bulunamadi.</p>
          <Link href="/dashboard">
            <Button className="mt-4">Panele Don</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const { input, result, risk } = analysis;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{input.product_name}</h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <span>{getMarketplaceLabel(input.marketplace)}</span>
                <span>·</span>
                <span>{new Date(analysis.createdAt).toLocaleDateString('tr-TR')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportJSON}>
              <Download className="mr-1.5 h-4 w-4" />
              JSON
            </Button>
            {isPro ? (
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="mr-1.5 h-4 w-4" />
                CSV
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <Lock className="mr-1.5 h-4 w-4" />
                CSV (Pro)
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Birim Net Kar</p>
            <p className={`mt-1 text-2xl font-bold ${result.unit_net_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(result.unit_net_profit)}
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Kar Marji</p>
            <p className={`mt-1 text-2xl font-bold ${result.margin_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatPercent(result.margin_pct)}
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Aylik Net Kar</p>
            <p className={`mt-1 text-2xl font-bold ${result.monthly_net_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(result.monthly_net_profit)}
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Basabas Fiyati</p>
            <p className="mt-1 text-2xl font-bold">
              {result.breakeven_price === Infinity ? '---' : formatCurrency(result.breakeven_price)}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col items-center rounded-2xl border bg-card p-6">
            <h3 className="mb-4 self-start text-sm font-semibold">Risk Puani</h3>
            <RiskGauge score={risk.score} level={risk.level} />
            {risk.factors.length > 0 && (
              <div className="mt-6 w-full space-y-2">
                {risk.factors.map((f) => (
                  <div key={f.name} className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-xs font-medium">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <CostBreakdown input={input} result={result} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User2 className="h-5 w-5 text-primary" />
                <h3 className="font-bold">Rakip Takibi</h3>
              </div>
              <Button size="sm" variant="outline" onClick={handleSaveCompetitor} disabled={saving}>
                <Save className="mr-1.5 h-4 w-4" /> Kaydet
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Rakip Adi</Label>
                <Input placeholder="Orn: MegaSatici" value={compName} onChange={e => setCompName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rakip Fiyati</Label>
                <div className="relative">
                  <Input type="number" value={compPrice || ''} onChange={e => setCompPrice(parseFloat(e.target.value))} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₺</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Hedef Pozisyon</Label>
              <Select value={targetPos} onValueChange={(v: any) => setTargetPos(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cheaper">Daha Ucuz (%3 altı)</SelectItem>
                  <SelectItem value="same">Ayni Fiyat</SelectItem>
                  <SelectItem value="premium">Premium (+%5 ustu)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {compPrice > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fiyat Farkı:</span>
                  <span className={`font-semibold ${input.sale_price > compPrice ? 'text-red-500' : 'text-emerald-500'}`}>
                    {formatCurrency(input.sale_price - compPrice)} ({formatPercent(((input.sale_price - compPrice) / compPrice) * 100)})
                  </span>
                </div>

                {(() => {
                  let suggested = compPrice;
                  if (targetPos === 'cheaper') suggested = compPrice * 0.97;
                  if (targetPos === 'premium') suggested = compPrice * 1.05;

                  return (
                    <div className="flex items-center justify-between pt-2 border-t border-primary/20">
                      <div>
                        <p className="text-xs text-muted-foreground">Onerilen Fiyat</p>
                        <p className="text-lg font-bold text-primary">{formatCurrency(suggested)}</p>
                      </div>
                      <Button size="sm" onClick={() => handleApplySuggestedPrice(suggested)} disabled={saving}>
                        <Rocket className="mr-1.5 h-3.5 w-3.5" /> Uygula
                      </Button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-4 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
              <h3 className="font-bold">Akilli Oneriler</h3>
            </div>
            <div className="space-y-4">
              {result.margin_pct < 10 && (
                <div className="flex gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                  <p className="text-sm">Marjiniz cok dusuk. Maliyet kalemlerini veya satis fiyatini gozden gecirmelisiniz.</p>
                </div>
              )}
              {input.ad_cost_per_sale > result.unit_net_profit && (
                <div className="flex gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                  <p className="text-sm">Reklam maliyetiniz birim kardan yuksek! Zarar ediyorsunuz.</p>
                </div>
              )}
              {compPrice > 0 && input.sale_price < compPrice * 0.9 && (
                <div className="flex gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <p className="text-sm">Piyasa fiyatindan %10 daha ucuzsunuz. Marj arttirmak icin fiyat yukseltebilirsiniz.</p>
                </div>
              )}
              <div className="flex gap-2 text-muted-foreground">
                <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 font-bold text-primary" />
                <p className="text-sm">Iade oranini %1 dusurmek size aylik <b>{formatCurrency(result.monthly_revenue * 0.01)}</b> ek kar saglar.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Vergi Etkisi (Birim KDV)</p>
            <p className="mt-1 text-2xl font-bold text-red-500">
              -{formatCurrency(result.vat_amount)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Satis fiyatina dahil edilen KDV tutari.</p>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Aylik Ciro</p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(result.monthly_revenue)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{input.monthly_sales_volume} adet x {formatCurrency(input.sale_price)}</p>
          </div>
        </div>

        {isPro ? (
          <SensitivityTable input={input} />
        ) : (
          <ProLockedSection title="Hassasiyet Analizi" />
        )}

        {isPro ? (
          <MarketplaceComparison input={input} />
        ) : (
          <ProLockedSection title="Pazaryeri Karsilastirmasi" />
        )}

        {isPro ? (
          <CashflowEstimator input={input} />
        ) : (
          <ProLockedSection title="Nakit Akisi Tahmini" />
        )}

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Bu arac tahmini hesaplama yapar. Muhasebecinize danismadan finansal karar vermeyin.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ProLockedSection({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center">
      <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Bu ozellik Pro planla kullanilabilir.
      </p>
      <Link href="/pricing">
        <Button size="sm" className="mt-4">Pro&apos;ya Yukselt</Button>
      </Link>
    </div>
  );
}
