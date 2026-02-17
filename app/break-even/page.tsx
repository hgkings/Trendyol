'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency } from '@/components/shared/format';
import { toast } from 'sonner';
import { Calculator, Target, TrendingUp, DollarSign, Save, Info } from 'lucide-react';

export default function BreakEvenPage() {
    const { user, updateProfile } = useAuth();

    // Inputs
    const [avgPrice, setAvgPrice] = useState<number>(0);
    const [avgVarCost, setAvgVarCost] = useState<number>(0);
    const [fixedCost, setFixedCost] = useState<number>(0);
    const [targetProfit, setTargetProfit] = useState<number>(0);

    // Loading state
    const [isSaving, setIsSaving] = useState(false);

    // Initialize from user profile
    useEffect(() => {
        if (user) {
            if (user.fixed_cost_monthly) setFixedCost(user.fixed_cost_monthly);
            if (user.target_profit_monthly) setTargetProfit(user.target_profit_monthly);
        }
    }, [user]);

    // Calculations
    const contribution = avgPrice - avgVarCost;
    const isValidContribution = contribution > 0;

    const breakEvenOrders = isValidContribution
        ? Math.ceil(fixedCost / contribution)
        : 0;

    const breakEvenRevenue = breakEvenOrders * avgPrice;

    const targetOrders = isValidContribution
        ? Math.ceil((fixedCost + targetProfit) / contribution)
        : 0;

    const handleSaveDefaults = async () => {
        if (!user) return;
        setIsSaving(true);
        const result = await updateProfile({
            fixed_cost_monthly: fixedCost,
            target_profit_monthly: targetProfit
        });

        if (result.success) {
            toast.success('Varsayılan gider ve hedef kâr kaydedildi.');
        } else {
            toast.error('Kaydetme başarısız: ' + result.error);
        }
        setIsSaving(false);
    };

    return (
        <DashboardLayout>
            <div className="space-y-8 pb-12 max-w-5xl mx-auto">

                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Başabaş & Hedef Kâr</h1>
                    <p className="text-muted-foreground mt-2">
                        İşletmenizin kâra geçmesi için gereken satış adedini ve ciro hedeflerini hesaplayın.
                    </p>
                </div>

                <div className="grid gap-8 lg:grid-cols-3">

                    {/* Input Section */}
                    <Card className="lg:col-span-1 h-fit shadow-md border-muted/40">
                        <CardHeader className="bg-muted/10 pb-4">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Calculator className="h-5 w-5 text-primary" />
                                Hesaplama Verileri
                            </CardTitle>
                            <CardDescription>
                                Ürün ve işletme giderlerinizi girin.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-6">

                            <div className="space-y-2">
                                <Label>Ortalama Sipariş Tutarı (KDV Dahil)</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="0.00"
                                        value={avgPrice || ''}
                                        onChange={(e) => setAvgPrice(parseFloat(e.target.value) || 0)}
                                        className="pl-9 tabular-nums"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₺</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Ort. Değişken Maliyet (Sipariş Başı)</Label>
                                </div>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="0.00"
                                        value={avgVarCost || ''}
                                        onChange={(e) => setAvgVarCost(parseFloat(e.target.value) || 0)}
                                        className="pl-9 tabular-nums"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₺</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Ürün maliyeti + kargo + paketleme + komisyon + reklam.
                                </p>
                            </div>

                            <div className="pt-2 border-t border-dashed my-4" />

                            <div className="space-y-2">
                                <Label className="text-primary font-medium">Aylık Sabit Giderler</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="0.00"
                                        value={fixedCost || ''}
                                        onChange={(e) => setFixedCost(parseFloat(e.target.value) || 0)}
                                        className="pl-9 tabular-nums border-primary/20 bg-primary/5"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₺</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-emerald-600 dark:text-emerald-500 font-medium">Aylık Hedef Net Kâr</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="0.00"
                                        value={targetProfit || ''}
                                        onChange={(e) => setTargetProfit(parseFloat(e.target.value) || 0)}
                                        className="pl-9 tabular-nums border-emerald-500/20 bg-emerald-500/5"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₺</span>
                                </div>
                            </div>

                            <Button
                                onClick={handleSaveDefaults}
                                disabled={isSaving}
                                variant="outline"
                                className="w-full mt-2 gap-2 text-xs h-9"
                            >
                                <Save className="h-3.5 w-3.5" />
                                {isSaving ? 'Kaydediliyor...' : 'Gider ve Hedefi Kaydet'}
                            </Button>

                        </CardContent>
                    </Card>

                    {/* Results Section */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Error State */}
                        {!isValidContribution && avgPrice > 0 && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3 dark:bg-red-900/10 dark:border-red-900/30">
                                <div className="p-2 bg-white dark:bg-red-900/20 rounded-full shadow-sm">
                                    <Info className="h-5 w-5 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-red-900 dark:text-red-300">Negatif Katkı Payı</h3>
                                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                                        Ortalama satış fiyatınız değişken maliyetlerinizi karşılamıyor.
                                        Lütfen birim fiyatı yükseltin veya maliyetleri düşürün.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* KPI Grid */}
                        <div className="grid gap-4 sm:grid-cols-2">

                            {/* Break-even Orders */}
                            <Card className="shadow-sm border-l-4 border-l-blue-500">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Başabaş Sipariş Adedi</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold tracking-tight tabular-nums">
                                        {isValidContribution ? breakEvenOrders.toLocaleString('tr-TR') : '-'}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Zarar etmemek için gereken aylık sipariş.
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Break-even Revenue */}
                            <Card className="shadow-sm border-l-4 border-l-violet-500">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Başabaş Ciro</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold tracking-tight tabular-nums">
                                        {isValidContribution ? formatCurrency(breakEvenRevenue) : '-'}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Sabit giderleri karşılayan toplam satış.
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Target Profit Orders */}
                            <Card className="sm:col-span-2 shadow-sm border-l-4 border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/10">
                                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                    <div className="space-y-1">
                                        <CardTitle className="text-sm font-medium text-emerald-900 dark:text-emerald-400">
                                            Hedef Kâra Ulaşmak İçin Gereken
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            {formatCurrency(targetProfit)} net kâr hedefine ulaşmak için.
                                        </CardDescription>
                                    </div>
                                    <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col sm:flex-row gap-6 mt-2">
                                        <div>
                                            <span className="text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400 tabular-nums">
                                                {isValidContribution ? targetOrders.toLocaleString('tr-TR') : '-'}
                                            </span>
                                            <span className="text-sm text-muted-foreground ml-2">Adet Sipariş</span>
                                        </div>
                                        <div className="w-px bg-border hidden sm:block h-10" />
                                        <div>
                                            <span className="text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400 tabular-nums">
                                                {isValidContribution ? formatCurrency(targetOrders * avgPrice) : '-'}
                                            </span>
                                            <span className="text-sm text-muted-foreground ml-2">Ciro</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Explanation */}
                        <div className="rounded-xl bg-card border p-4 text-sm text-muted-foreground space-y-2">
                            <div className="flex items-center gap-2 font-medium text-foreground">
                                <Info className="h-4 w-4" />
                                <span>Bu Veriler Ne Anlama Geliyor?</span>
                            </div>
                            <p>
                                <span className="font-semibold text-foreground">Başabaş Noktası:</span> İşletmenizin ne kâr ne de zarar ettiği noktadır.
                                Bu noktadan sonraki her satış doğrudan kârınıza katkı sağlar.
                            </p>
                            <p>
                                <span className="font-semibold text-foreground">Katkı Payı ({isValidContribution ? formatCurrency(contribution) : '-'}):</span>
                                Sipariş başına elde edilen brüt kazançtır. Bu tutar önce sabit giderleri karşılar, ardından net kâr oluşturur.
                            </p>
                        </div>

                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
