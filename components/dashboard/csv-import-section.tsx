'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Upload,
    Copy,
    Download,
    AlertCircle,
    CheckCircle2,
    FileBox,
    ChevronRight,
    Info,
    X
} from 'lucide-react';
import { toast } from 'sonner';
import { parseCSV, CSV_TEMPLATE } from '@/lib/csv';
import { ProductInput } from '@/types';
import { cn } from '@/lib/utils';
import { formatCurrency } from '../shared/format';
import { useAuth } from '@/contexts/auth-context';
import { hasFeature } from '@/utils/access';
import { useRouter } from 'next/navigation';
// Mock hook if actual one doesn't exist yet, or just use router for now
const useUpgradeModal = () => ({ onOpen: () => { } });

interface CSVImportSectionProps {
    onImport: (data: ProductInput[]) => Promise<void>;
}

export function CSVImportSection({ onImport }: CSVImportSectionProps) {
    const [mode, setMode] = useState<'upload' | 'paste'>('upload');
    const [pasteText, setPasteText] = useState('');
    const [data, setData] = useState<ProductInput[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [missingCols, setMissingCols] = useState<string[]>([]);
    const [importOnlyValid, setImportOnlyValid] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const reset = () => {
        setData([]);
        setErrors([]);
        setWarnings([]);
        setMissingCols([]);
        setPasteText('');
        setIsProcessing(false);
    };

    const handleDownloadTemplate = () => {
        const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kar_kocu_sablon.csv';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Şablon indirildi.');
    };

    const handleCopyTemplate = () => {
        navigator.clipboard.writeText(CSV_TEMPLATE);
        toast.success('Şablon panoya kopyalandı.');
    };

    const handleProcessText = (text: string) => {
        if (!text.trim()) {
            setData([]);
            setErrors([]);
            setMissingCols([]);
            return;
        }
        const result = parseCSV(text);
        setData(result.data);
        setErrors(result.errors);
        setMissingCols(result.missingColumns);

        // Generate warnings
        const w: string[] = [];
        if (result.data.length > 0) {
            const lowPrice = result.data.filter(i => i.sale_price <= 0).length;
            if (lowPrice > 0) w.push(`${lowPrice} ürünün satış fiyatı 0 veya geçersiz.`);

            const lowCost = result.data.filter(i => i.product_cost <= 0).length;
            if (lowCost > 0) w.push(`${lowCost} ürünün maliyeti 0. Kâr %100 görünebilir.`);

            const noSales = result.data.filter(i => !i.monthly_sales_volume || i.monthly_sales_volume <= 0).length;
            if (noSales > 0) w.push(`${noSales} ürünün satış adedi girilmemiş (Varsayılan: 0).`);
        }
        setWarnings(w);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            handleProcessText(text);
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const { user } = useAuth();
    const router = useRouter(); // To redirect to pricing if needed
    const { onOpen } = useUpgradeModal(); // Assuming we have this, if not we'll use toast + redirect

    const handleImport = async () => {
        if (!hasFeature(user, 'csvImport')) {
            toast.error('Bu özellik Başlangıç veya Pro pakette mevcuttur.', {
                action: {
                    label: 'Yükselt',
                    onClick: () => router.push('/pricing')
                }
            });
            return;
        }

        if (data.length === 0 && errors.length === 0) return;

        setIsProcessing(true);
        try {
            await onImport(data);
            reset();
            toast.success('Başarıyla içe aktarıldı.');
        } catch (err) {
            toast.error('İçe aktarma sırasında hata oluştu.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="rounded-2xl border border-amber-500/20 bg-[rgba(255,255,255,0.03)] p-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-bold">CSV / Toplu Analiz Yükle</h2>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex bg-[rgba(255,255,255,0.04)] rounded-lg p-1 w-fit">
                            <button
                                onClick={() => { setMode('upload'); reset(); }}
                                className={cn(
                                    "px-4 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                                    mode === 'upload' ? "bg-background shadow-sm" : "hover:bg-background/50"
                                )}
                            >
                                Dosya Yükle
                            </button>
                            <button
                                onClick={() => { setMode('paste'); reset(); }}
                                className={cn(
                                    "px-4 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                                    mode === 'paste' ? "bg-background shadow-sm" : "hover:bg-background/50"
                                )}
                            >
                                Metin Yapıştır
                            </button>
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button variant="ghost" size="sm" className="h-8 text-xs flex-1 sm:flex-initial whitespace-nowrap" onClick={handleCopyTemplate}>
                                <Copy className="mr-1.5 h-3.5 w-3.5" />
                                Şablonu Kopyala
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 text-xs flex-1 sm:flex-initial whitespace-nowrap" onClick={handleDownloadTemplate}>
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                Şablonu İndir
                            </Button>
                        </div>
                    </div>

                    {mode === 'upload' ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-muted rounded-2xl p-4 sm:p-8 flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
                        >
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <FileBox className="h-5 w-5 text-primary" />
                            </div>
                            <p className="text-sm font-medium">Dosyayı seçin veya buraya sürükleyin</p>
                            <p className="text-[10px] text-muted-foreground">Sadece .csv dosyaları desteklenir</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <Textarea
                                placeholder="Örn: marketplace,product_name,..."
                                className="min-h-[150px] font-mono text-[11px]"
                                value={pasteText}
                                onChange={(e) => {
                                    setPasteText(e.target.value);
                                    handleProcessText(e.target.value);
                                }}
                            />
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Info className="h-3 w-3" />
                                Başlık satırı dahil edilmelidir. Virgül (,) ile ayrılmış formatta olmalıdır.
                            </p>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm">Önizleme & Doğrulama</h3>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="import-valid" className="text-xs cursor-pointer">Sadece geçerli satırları aktar</Label>
                            <Switch
                                id="import-valid"
                                checked={importOnlyValid}
                                onCheckedChange={setImportOnlyValid}
                            />
                        </div>
                    </div>

                    <div className="max-h-[250px] overflow-y-auto space-y-3 pr-2">
                        {missingCols.length > 0 && (
                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 flex gap-3">
                                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-red-400">Eksik Sütunlar!</p>
                                    <p className="text-[10px] text-red-400">
                                        Zorunlu sütunlar bulunamadı: <span className="font-mono font-bold">{missingCols.join(', ')}</span>
                                    </p>
                                </div>
                            </div>
                        )}

                        {errors.length > 0 && (
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                                    <p className="text-xs font-bold text-amber-400">{errors.length} hatayla karşılaşıldı</p>
                                </div>
                                <div className="space-y-1">
                                    {errors.map((err, i) => (
                                        <p key={i} className="text-[10px] text-amber-400 border-l-2 border-amber-500/30 pl-2">{err}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {warnings.length > 0 && (
                            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <Info className="h-3.5 w-3.5 text-blue-600" />
                                    <p className="text-xs font-bold text-blue-400">Dikkat Edilmesi Gerekenler</p>
                                </div>
                                <div className="space-y-1">
                                    {warnings.map((w, i) => (
                                        <p key={i} className="text-[10px] text-blue-400 border-l-2 border-blue-500/30 pl-2">{w}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {data.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    <p className="text-xs font-bold text-emerald-400">{data.length} geçerli ürün hazır</p>
                                </div>
                                <div className="rounded-xl border border-border overflow-hidden">
                                    <table className="w-full text-[10px] text-left">
                                        <thead className="bg-muted">
                                            <tr>
                                                <th className="px-2 py-1 font-semibold">Pazaryeri</th>
                                                <th className="px-2 py-1 font-semibold">Ürün Adı</th>
                                                <th className="px-2 py-1 font-semibold text-right">Fiyat</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {data.slice(0, 3).map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-2 py-1 capitalize">{item.marketplace}</td>
                                                    <td className="px-2 py-1 truncate max-w-[120px]">{item.product_name}</td>
                                                    <td className="px-2 py-1 text-right">{formatCurrency(item.sale_price)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="pt-2">
                        <Button
                            className="w-full"
                            disabled={(!importOnlyValid && errors.length > 0) || data.length === 0 || isProcessing}
                            onClick={handleImport}
                        >
                            {isProcessing ? (
                                <>İşleniyor...</>
                            ) : (
                                <>
                                    İçe Aktarımı Başlat ({data.length} Ürün)
                                    <ChevronRight className="ml-1.5 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
