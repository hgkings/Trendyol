'use client';

import { ProductInput, CalculationResult } from '@/types';
import { formatCurrency } from '@/components/shared/format';
import { Receipt, ArrowRight, TrendingDown, Landmark } from 'lucide-react';
import { n } from '@/utils/calculations';

interface VatImpactCardProps {
    input: ProductInput;
    result: CalculationResult;
}

export function VatImpactCard({ input, result }: VatImpactCardProps) {
    const isProMode = input.pro_mode === true;
    const isVatIncluded = input.sale_price_includes_vat !== false;

    // Guard values
    const saleVatUnit = Number.isFinite(result.vat_amount) ? result.vat_amount : 0;
    const netPrice = Number.isFinite(result.sale_price_excl_vat) ? result.sale_price_excl_vat : 0;

    const vatPos = Number.isFinite(result.vat_position_monthly) ? result.vat_position_monthly : 0;
    const inputVat = Number.isFinite(result.input_vat_monthly) ? result.input_vat_monthly : 0;
    const outputVat = Number.isFinite(result.output_vat_monthly) ? result.output_vat_monthly : 0;

    const fmt = (val: number) => {
        if (!Number.isFinite(val)) return '—';
        return formatCurrency(val);
    };

    if (!isProMode) {
        return (
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Vergi Etkisi (Birim KDV)</p>
                        <p className="mt-1 text-2xl font-bold text-foreground">
                            {fmt(Math.abs(saleVatUnit))}
                        </p>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-2">
                        <Receipt className="h-5 w-5 text-primary" />
                    </div>
                </div>

                <div className="mt-3 pt-3 border-t">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">KDV Hariç Satış:</span>
                        <span className="font-medium text-foreground">{fmt(netPrice)}</span>
                    </div>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                        Birim fiyat KDV dahil kabul edilerek hesaplanmıştır (%{input.vat_pct}).
                    </p>
                </div>
            </div>
        );
    }

    // PRO MODE Detailed View
    return (
        <div className="rounded-2xl border-2 border-primary/20 bg-card p-5 shadow-md">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-primary" />
                    <h3 className="text-sm font-bold uppercase tracking-tight">KDV & Vergi Pozisyonu</h3>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary">PRO MOD</Badge>
            </div>

            <div className="space-y-4">
                {/* Unit Info */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-muted/30 p-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Satış KDV (Birim)</p>
                        <p className="text-lg font-bold text-red-500">{fmt(saleVatUnit)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/30 p-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Net Satış (Birim)</p>
                        <p className="text-lg font-bold text-foreground">{fmt(netPrice)}</p>
                    </div>
                </div>

                {/* Monthly Position */}
                <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground flex items-center gap-1"><ArrowRight className="h-3 w-3" /> Toplam Çıkış KDV (Satış)</span>
                        <span className="font-bold text-red-500">{fmt(outputVat)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-b border-primary/10 pb-2">
                        <span className="text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Toplam Giriş KDV (Alış+Gider)</span>
                        <span className="font-bold text-emerald-500">{fmt(inputVat)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                        <span className="text-xs font-bold">Aylık KDV Pozisyonu:</span>
                        <span className={`text-sm font-black ${vatPos >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {vatPos >= 0 ? `Ödenecek: ${fmt(vatPos)}` : `Devreden: ${fmt(Math.abs(vatPos))}`}
                        </span>
                    </div>
                </div>

                <p className="text-[9px] text-muted-foreground italic leading-tight">
                    * KDV pozisyonu tahmini olup, iade oranı düştükten sonra kalan satışlar üzerinden hesaplanmıştır.
                </p>
            </div>
        </div>
    );
}

// Internal helper for Badge if needed (or import from UI)
function Badge({ children, variant, className }: any) {
    return <span className={`px-1.5 py-0.5 rounded text-xs border ${className}`}>{children}</span>;
}
