
'use client';

import { useState } from 'react';
import { Analysis, Marketplace } from '@/types';
import { calculateProfit } from '@/utils/calculations';
import { calculateRisk } from '@/utils/risk-engine';
import { saveAnalysis } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { marketplaces } from '@/lib/marketplace-data';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface BulkUpdateModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    analyses: Analysis[];
    onComplete: () => void;
}

export function BulkUpdateModal({ open, onOpenChange, analyses, onComplete }: BulkUpdateModalProps) {
    const [loading, setLoading] = useState(false);
    const [filterMarketplace, setFilterMarketplace] = useState<Marketplace | 'all'>('all');
    const [updateType, setUpdateType] = useState<'price_pct' | 'price_fixed' | 'commission' | 'ad_cost'>('price_pct');
    const [updateValue, setUpdateValue] = useState<number>(0);

    const filteredAnalyses = analyses.filter(a =>
        filterMarketplace === 'all' || a.input.marketplace === filterMarketplace
    );

    const handleApply = async () => {
        if (filteredAnalyses.length === 0) {
            toast.error('Guncellenecek urun bulunamadi.');
            return;
        }

        setLoading(true);
        let successCount = 0;

        try {
            for (const analysis of filteredAnalyses) {
                const updatedInput = { ...analysis.input };

                switch (updateType) {
                    case 'price_pct':
                        updatedInput.sale_price = updatedInput.sale_price * (1 + updateValue / 100);
                        break;
                    case 'price_fixed':
                        updatedInput.sale_price = updatedInput.sale_price + updateValue;
                        break;
                    case 'commission':
                        updatedInput.commission_pct = updateValue;
                        break;
                    case 'ad_cost':
                        updatedInput.ad_cost_per_sale = updateValue;
                        break;
                }

                const result = calculateProfit(updatedInput);
                const risk = calculateRisk(updatedInput, result);

                const updatedAnalysis: Analysis = {
                    ...analysis,
                    input: updatedInput,
                    result,
                    risk,
                };

                const res = await saveAnalysis(updatedAnalysis);
                if (res.success) successCount++;
            }

            toast.success(`${successCount} urun basariyla guncellendi.`);
            onComplete();
            onOpenChange(false);
        } catch (error) {
            console.error('Bulk update error:', error);
            toast.error('Toplu guncelleme sirasinda bir hata olustu.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Toplu Guncelleme</DialogTitle>
                    <DialogDescription>
                        Secili kriterlere uyan tum urun analizlerini tek seferde guncelleyin.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="space-y-2">
                        <Label>Pazaryeri Filtresi</Label>
                        <Select value={filterMarketplace} onValueChange={(v) => setFilterMarketplace(v as any)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pazaryeri secin" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tum Pazaryerleri</SelectItem>
                                {marketplaces.map(mp => (
                                    <SelectItem key={mp.key} value={mp.key}>{mp.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {filteredAnalyses.length} urun etkilenecek.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Guncelleme Tipi</Label>
                            <Select value={updateType} onValueChange={(v) => setUpdateType(v as any)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="price_pct">Satis Fiyati +%</SelectItem>
                                    <SelectItem value="price_fixed">Satis Fiyati +₺</SelectItem>
                                    <SelectItem value="commission">Komisyon Set (%)</SelectItem>
                                    <SelectItem value="ad_cost">Reklam Set (₺)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Deger</Label>
                            <Input
                                type="number"
                                value={updateValue}
                                onChange={(e) => setUpdateValue(parseFloat(e.target.value))}
                            />
                        </div>
                    </div>

                    {updateValue !== 0 && (
                        <div className="rounded-lg bg-amber-50 p-3 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
                            <div className="flex gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800 dark:text-amber-400">
                                    Bu islem {filteredAnalyses.length} urunun verilerini kalici olarak degistirecek ve kar oranlarini yeniden hesaplayacaktir.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Iptal
                    </Button>
                    <Button onClick={handleApply} disabled={loading || filteredAnalyses.length === 0}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Guncelleniyor...
                            </>
                        ) : (
                            'Uygula'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
