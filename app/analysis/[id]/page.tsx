'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Analysis } from '@/types';
import { getAnalysisById } from '@/lib/api/analyses';
import { useAuth } from '@/contexts/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RiskGauge } from '@/components/shared/risk-gauge';
import { RiskBadge } from '@/components/shared/risk-badge';
import { CostBreakdown } from '@/components/analysis/cost-breakdown';
import { SensitivityTable } from '@/components/analysis/sensitivity-table';
import { MarketplaceComparison } from '@/components/analysis/marketplace-comparison';
import { CashflowEstimator } from '@/components/analysis/cashflow-estimator';
import { VatImpactCard } from '@/components/analysis/vat-impact-card';
import { MinPriceCards } from '@/components/analysis/min-price-cards';
import { ScenarioSimulator } from '@/components/analysis/scenario-simulator';
import { CampaignSimulator } from '@/components/analysis/campaign-simulator';
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
  Rocket,
  FileText,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { saveAnalysis } from '@/lib/api/analyses';
import { calculateProfit, calculateAdCeiling, n } from '@/utils/calculations';
import { calculateProAccounting } from '@/utils/pro-accounting';
import { calculateRisk } from '@/utils/risk-engine';
import { toast } from 'sonner';
import { analysesToJSON, analysesToCSV } from '@/lib/csv';
import { ProLockedSection } from '@/components/shared/pro-locked-section';
import { UpgradeModal } from '@/components/shared/upgrade-modal';
import { isProUser } from '@/utils/access';
import { createClient } from '@/lib/supabase/client';
import { CollapsibleCard } from '@/components/shared/collapsible-card';

export default function AnalysisResultPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Competitor states
  const [compName, setCompName] = useState('');
  const [compPrice, setCompPrice] = useState<number>(0);
  const [targetPos, setTargetPos] = useState<'cheaper' | 'same' | 'premium'>('same');

  useEffect(() => {
    if (!user) return;
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
  }, [params.id, user]);

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
      toast.error('Hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const isPro = isProUser(user);

  const handleApplySuggestedPrice = async (price: number) => {
    if (!analysis) return;
    setSaving(true);
    try {
      const updatedInput = { ...analysis.input, sale_price: price };
      const mode = (isPro && updatedInput.accounting_mode === 'pro') ? 'pro' : 'standard';

      const updatedResult = mode === 'pro'
        ? calculateProAccounting(updatedInput)
        : calculateProfit(updatedInput);

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
        toast.success('Fiyat güncellendi ve yeniden hesaplandı.');
      }
    } catch (e) {
      toast.error('Hata oluştu.');
    } finally {
      setSaving(false);
    }
  };


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
    try {
      const csv = analysesToCSV([analysis]);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${analysis.input.product_name}-analiz.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV dosyası indirildi.');
    } catch {
      toast.error('CSV dışa aktarma başarısız.');
    }
  };



  const handleExportPDF = async () => {
    if (!analysis) return;

    // Client-side Pro check
    if (!isProUser(user)) {
      setShowUpgrade(true);
      return;
    }

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
        window.location.href = '/auth';
        return;
      }

      toast.loading('PDF hazırlanıyor...', { id: 'pdf-download' });

      const res = await fetch(`/api/pdf/analysis/${params.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      toast.dismiss('pdf-download');

      if (res.status === 401) {
        toast.error('Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');
        window.location.href = '/auth';
        return;
      }

      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        console.warn("[PDF Export] 403 Forbidden:", errData);
        // If server says PRO_REQUIRED, show upgrade modal even if client thought it was Pro (sync issue)
        if (errData.error === "PRO_REQUIRED") {
          setShowUpgrade(true);
        } else {
          toast.error("Yetki hatası: " + (errData.error || "Erişim reddedildi"));
        }
        return;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.error("PDF Error:", errJson);
        toast.error(`PDF oluşturulamadı: ${errJson.error || 'Hata'} (${errJson.details || ''})`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${analysis.input.product_name}-rapor.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF indirildi!');
    } catch (err) {
      console.error(err);
      toast.dismiss('pdf-download');
      toast.error('PDF indirme hatası.');
    }
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
          <p className="text-muted-foreground">Analiz bulunamadı.</p>
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
                <span>
                  {getMarketplaceLabel(input.marketplace)}
                  {(input.marketplace_category || input.trendyol_category) &&
                    ` - ${input.marketplace_category || input.trendyol_category} (%${input.commission_pct})`}
                </span>
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={loading || authLoading}
            >
              {(loading || authLoading) ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-1.5 h-4 w-4" />
              )}
              PDF İndir
            </Button>
          </div>
        </div>

        {/* Compact Key Metrics Grid */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <div className="rounded-xl border border-border/40 bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Birim net kâr</p>
            <p className={`mt-0.5 text-xl sm:text-2xl font-bold tracking-tight ${result.unit_net_profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(result.unit_net_profit)}
            </p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Kâr marjı</p>
            <p className={`mt-0.5 text-xl sm:text-2xl font-bold tracking-tight ${result.margin_pct >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
              {formatPercent(result.margin_pct)}
            </p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Aylık net kâr</p>
            <p className={`mt-0.5 text-xl sm:text-2xl font-bold tracking-tight ${result.monthly_net_profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(result.monthly_net_profit)}
            </p>
          </div>

          {/* Integrated Ad Ceiling */}
          <div className="rounded-xl border border-border/40 bg-card p-4">
            {(() => {
              const adCeiling = calculateAdCeiling(input);
              const isLoss = adCeiling <= 0;
              const isRisk = input.ad_cost_per_sale > adCeiling;

              return (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Reklam tavanı</p>
                    {isRisk && <span className="animate-pulse h-2 w-2 rounded-full bg-red-500"></span>}
                  </div>
                  <p className={`mt-0.5 text-xl sm:text-2xl font-black tracking-tight ${isLoss || isRisk ? 'text-red-400' : 'text-foreground'}`}>
                    {isLoss ? 'Kâr Yok' : formatCurrency(adCeiling)}
                  </p>
                </>
              );
            })()}
          </div>
        </div>


        {/* Minimum Kârlı Satış Fiyatı — 3 kart */}
        <div className="rounded-2xl border border-border/40 bg-card p-6">
          <MinPriceCards input={input} currentPrice={input.sale_price} />
        </div>

        {/* Main Content Grid (12 Columns on Desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT COLUMN (8/12) */}
          <div className="lg:col-span-8 space-y-6 min-w-0">

            {/* Cost Breakdown */}
            <CostBreakdown input={input} result={result} />

            {/* İade Analizi Kartı */}
            {(() => {
              const returnRate = n(input.return_rate_pct, 0);
              const monthlySales = n(input.monthly_sales_volume, 0);
              const expectedReturns = Math.round((returnRate / 100) * monthlySales);
              // expected_return_loss zaten formülde var; iade öncesi kâr = net + iade etkisi
              const returnImpactUnit = result.expected_return_loss;
              const profitBeforeReturn = result.unit_net_profit + returnImpactUnit;
              const isHighReturn = returnRate >= 20;
              const isNegativeAfterReturn = result.unit_net_profit < 0;
              // Pro modunda girilen ek iade maliyeti (kargo, operasyon vb. — birim başı)
              const extraReturnCost = n(input.return_extra_cost, 0);
              // Beklenen iade başına ekstra maliyet → birim satışa yayılan etki
              const extraReturnImpactUnit = (returnRate / 100) * extraReturnCost;
              const isProMode = input.pro_mode === true;

              return (
                <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📦</span>
                    <h3 className="text-sm font-semibold text-foreground border-b border-border/20 pb-2 mb-2">İade analizi</h3>
                  </div>

                  {/* İade uyarı kartları */}
                  {isNegativeAfterReturn && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs font-medium text-red-400">
                      🔴 Beklenen iadeler hesaba katıldığında bu ürün ZARAR ettiriyor!
                    </div>
                  )}
                  {!isNegativeAfterReturn && isHighReturn && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                      ⚠️ Yüksek iade oranı! {monthlySales > 0 ? `${monthlySales} satışta ~${expectedReturns} iade bekleniyor.` : ''} Net kârınız iade maliyetlerini karşılıyor mu? Fiyatlandırmanızı gözden geçirmenizi öneririz.
                    </div>
                  )}

                  {/* Metrikler */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">İade Oranı</span>
                      <span className="font-semibold">{formatPercent(returnRate)}</span>
                    </div>
                    {monthlySales > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Aylık Beklenen İade</span>
                        <span className="font-semibold">{monthlySales} satışta ~{expectedReturns} adet</span>
                      </div>
                    )}
                    <div className="border-t pt-2.5 space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">İade Etkisi (birim)</span>
                        <span className="font-semibold text-red-400">
                          -{formatCurrency(returnImpactUnit)}
                        </span>
                      </div>
                      {extraReturnCost > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">
                            Ek İade Maliyeti
                            {!isProMode && <span className="ml-1 text-[10px] text-amber-500">(bilgi)</span>}
                          </span>
                          <span className="font-semibold text-orange-400">
                            -{formatCurrency(extraReturnImpactUnit)}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({formatCurrency(extraReturnCost)}/iade)
                            </span>
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">İade Öncesi Kâr</span>
                        <span className={`font-semibold ${profitBeforeReturn >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
                          {formatCurrency(profitBeforeReturn)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="font-bold text-sm">İade Sonrası Net</span>
                        <div className="text-right">
                          <p className={`text-xl font-black ${result.unit_net_profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency(result.unit_net_profit)}
                            <span className="ml-1 text-base">{result.unit_net_profit >= 0 ? '✅' : '🔴'}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{formatPercent(result.margin_pct)} marj</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* VAT Impact & Monthly Revenue */}
            <div className="grid gap-6 md:grid-cols-2">
              <VatImpactCard input={input} result={result} />
              <div className="rounded-2xl border border-border/40 bg-card p-5">
                <p className="text-xs font-medium text-muted-foreground">Aylik Ciro</p>
                <p className="mt-1 text-2xl font-bold">{formatCurrency(result.monthly_revenue)}</p>
                <p className="mt-1 text-xs text-muted-foreground break-all">{input.monthly_sales_volume} adet x {formatCurrency(input.sale_price)}</p>
              </div>
            </div>

            {/* Scenario Simulator */}
            <div className="min-w-0">
              <ScenarioSimulator input={input} />
            </div>

            {/* Kampanya Simülatörü */}
            <div className="min-w-0">
              <CampaignSimulator input={input} originalResult={result} />
            </div>

            {/* Collapsible Heavy Data Sections */}
            <CollapsibleCard title="Hassasiyet Analizi" description="Farklı senaryolarda kâr değişimi" defaultOpen={false}>
              <ProLockedSection title="Hassasiyet Analizi" feature="sensitivityAnalysis">
                <SensitivityTable input={input} />
              </ProLockedSection>
            </CollapsibleCard>

            <CollapsibleCard title="Pazaryeri Karşılaştırması" description="Diğer pazaryerleri" defaultOpen={false}>
              <ProLockedSection title="Pazaryeri Karşılaştırması" feature="marketplaceComparison">
                <MarketplaceComparison input={input} />
              </ProLockedSection>
            </CollapsibleCard>

            <CollapsibleCard title="Nakit Akışı Tahmini" description="Tahmini nakit durumu" defaultOpen={false}>
              <ProLockedSection title="Nakit Akışı Tahmini" feature="cashflow">
                <CashflowEstimator input={input} />
              </ProLockedSection>
            </CollapsibleCard>

          </div>

          {/* RIGHT COLUMN (4/12) */}
          <div className="lg:col-span-4 space-y-6 min-w-0">
            {/* Risk Gauge */}
            <div className="flex flex-col items-center rounded-xl border border-border/40 bg-card p-5">
              <h3 className="mb-4 self-start text-sm font-semibold text-foreground border-b border-border/20 pb-2 w-full">Risk skoru</h3>
              <RiskGauge score={risk.score} level={risk.level} />
              {risk.factors.length > 0 && (
                <div className="mt-6 w-full space-y-2">
                  {risk.factors.slice(0, 3).map((f) => (
                    <div key={f.name} className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 border border-red-500/20">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                      <div>
                        <p className="text-[10px] font-bold text-red-400 break-words">{f.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Smart Recommendations */}
            <div className="rounded-xl border border-border/40 bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-amber-500/10 rounded-md">
                  <TrendingUp className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Akıllı öneriler</h3>
              </div>
              <div className="space-y-3">
                {result.margin_pct < 10 && (
                  <div className="text-xs p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
                    ⚠️ Düşük Marj: Giderleri veya fiyatı gözden geçirin.
                  </div>
                )}
                {input.ad_cost_per_sale > result.unit_net_profit && (
                  <div className="text-xs p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                    🛑 Reklam Zararı: Reklam maliyeti kârı aşıyor.
                  </div>
                )}
                <div className="flex gap-2 text-xs text-muted-foreground p-2 rounded-lg bg-muted/10">
                  <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                  <p>İadeyi %1 düşürmek aylık <b>{formatCurrency(result.monthly_revenue * 0.01)}</b> kazandırır.</p>
                </div>
              </div>
            </div>

            {/* Competitor Analysis Link/Card - Keep it compact or move functionality inside? 
                The user had it in a card before. Let's keep the Competitor logic here to avoid losing it.
            */}
            <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User2 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Rakip analizi</h3>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveCompetitor} disabled={saving}>
                  <Save className="h-3 w-3" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Rakip Adı</Label>
                  <Input className="h-8 text-xs" placeholder="Örn: MegaSatıcı" value={compName} onChange={e => setCompName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rakip Fiyatı</Label>
                  <Input className="h-8 text-xs tabular-nums" type="number" min={0} value={compPrice || ''} onChange={e => { const v = parseFloat(e.target.value); setCompPrice(isNaN(v) || v < 0 ? 0 : v); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Konum</Label>
                  <Select value={targetPos} onValueChange={(v: string) => setTargetPos(v as 'cheaper' | 'same' | 'premium')}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cheaper">Daha Ucuz</SelectItem>
                      <SelectItem value="same">Aynı Fiyat</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {compPrice > 0 && (
                  <div className="pt-2 border-t mt-2">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-muted-foreground">Fark:</span>
                      <span className={input.sale_price > compPrice ? 'text-red-400' : 'text-emerald-700 dark:text-emerald-400'}>
                        {formatCurrency(input.sale_price - compPrice)}
                      </span>
                    </div>
                    {(() => {
                      let suggested = compPrice;
                      if (targetPos === 'cheaper') suggested = compPrice * 0.97;
                      if (targetPos === 'premium') suggested = compPrice * 1.05;
                      return (
                        <Button size="sm" variant="secondary" className="w-full text-xs h-7" onClick={() => handleApplySuggestedPrice(suggested)} disabled={saving}>
                          <Rocket className="mr-1.5 h-3 w-3" /> {formatCurrency(suggested)} Uygula
                        </Button>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Bu arac tahmini hesaplama yapar. Muhasebecinize danismadan finansal karar vermeyin.
          </p>
        </div>
      </div>
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </DashboardLayout>
  );
}


