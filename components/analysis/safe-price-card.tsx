'use client';

import { useState } from 'react';
import { ProductInput } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/components/shared/format';
import { ShieldCheck, Info } from 'lucide-react';
import { calculateBreakevenPrice } from '@/utils/calculations';

interface SafePriceCardProps {
    input: ProductInput;
    breakevenPrice: number;
}

export function SafePriceCard({ input, breakevenPrice }: SafePriceCardProps) {
    const [safetyMargin, setSafetyMargin] = useState('0'); // '0', '0.03', '0.05', '0.08'

    const margin = parseFloat(safetyMargin);
    const safePrice = breakevenPrice === Infinity ? 0 : breakevenPrice * (1 + margin);

    // Calculate potential profit at this safe price
    // Simple estimation: SafePrice - Breakeven = Profit per unit (roughly, if costs are linear)
    // Actually, profit = (Price - VariableCosts) - FixedCosts -> Breakeven is where Profit=0.
    // So Price > Breakeven means Profit > 0.

    return (
        <Card className="h-full border-l-4 border-l-emerald-500 shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                        <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    </div>
                    <div>
                        <CardTitle className="text-base font-bold">Güvenli Fiyat Aralığı</CardTitle>
                        <p className="text-xs text-muted-foreground">Zarar etmemek için minimum satış fiyatı.</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Güvenlik Payı</label>
                    <Select value={safetyMargin} onValueChange={setSafetyMargin}>
                        <SelectTrigger className="h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0">%0 (Tam Başabaş)</SelectItem>
                            <SelectItem value="0.03">%3 Güvenlik Payı</SelectItem>
                            <SelectItem value="0.05">%5 Güvenlik Payı</SelectItem>
                            <SelectItem value="0.08">%8 Güvenlik Payı</SelectItem>
                            <SelectItem value="0.10">%10 Güvenlik Payı</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                        Beklenmedik giderler (kur farkı, iade artışı) için tampon.
                    </p>
                </div>

                <div className="rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Min. Güvenli Fiyat</span>
                        <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                            {breakevenPrice === Infinity ? 'Hesaplanamaz' : formatCurrency(safePrice)}
                        </span>
                    </div>
                    {margin > 0 && (
                        <div className="flex justify-between items-center text-[10px] text-emerald-500/70 border-t border-emerald-800/30 pt-1 mt-1">
                            <span>Başabaş Noktası:</span>
                            <span>{formatCurrency(breakevenPrice)}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-muted/30 p-2 rounded-lg">
                    <Info className="h-3 w-3 mt-0.5" />
                    <span>Bu eşik mevcut maliyet yapınıza göre türetilmiştir. Satış fiyatınız bu değerin altına düşmemelidir.</span>
                </div>
            </CardContent>
        </Card>
    );
}
