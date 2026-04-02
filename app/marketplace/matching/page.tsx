'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import {
    Loader2,
    ArrowLeft,
    Link2,
    CheckCircle2,
    AlertTriangle,
    Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { getStoredAnalyses } from '@/lib/api/analyses';
import { getProductMap, manualMatchProduct, bulkMatchProducts } from '@/lib/api/products';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';

interface MappingRow {
    id: string;
    external_product_id: string;
    merchant_sku: string | null;
    barcode: string | null;
    external_title: string | null;
    internal_product_id: string | null;
    match_confidence: 'high' | 'medium' | 'manual_required';
}

interface AnalysisOption {
    id: string;
    product_name: string;
}

export default function MatchingPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [mappings, setMappings] = useState<MappingRow[]>([]);
    const [analyses, setAnalyses] = useState<AnalysisOption[]>([]);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'manual_required'>('manual_required');
    const [searchQuery, setSearchQuery] = useState('');
    const [bulkMatching, setBulkMatching] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const maps = await getProductMap('trendyol');
            setMappings((maps || []) as MappingRow[]);

            const allAnalyses = await getStoredAnalyses();
            const anl = allAnalyses.map((a: { id: string; input: { product_name: string } }) => ({
                id: a.id,
                product_name: a.input.product_name,
            })).sort((a: { product_name: string }, b: { product_name: string }) => a.product_name.localeCompare(b.product_name));

            setAnalyses(anl || []);
        } catch {
            toast.error('Veriler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleMatch = async (mappingId: string, analysisId: string) => {
        setSavingId(mappingId);
        try {
            await manualMatchProduct(mappingId, analysisId || null);
            toast.success('Eşleştirme kaydedildi!');
            fetchData();
        } catch (_matchError) {
            toast.error('Sunucu hatası.');
        } finally {
            setSavingId(null);
        }
    };

    const handleBulkAutoMatch = async () => {
        const unmatched = mappings.filter(m => m.match_confidence === 'manual_required');
        if (unmatched.length === 0) {
            toast.info('Eşleştirilecek ürün yok.');
            return;
        }
        if (!confirm(`${unmatched.length} eşleşmemiş ürün otomatik eşleştirilecek. Devam etmek istiyor musunuz?`)) return;
        setBulkMatching(true);
        try {
            const matches: Array<{ mapId: string; internalProductId: string | null }> = [];
            for (const mapping of unmatched) {
                const title = (mapping.external_title || '').toLowerCase().trim();
                if (!title) continue;
                // En iyi eşleşmeyi bul — basit includes kontrolü
                const match = analyses.find(a =>
                    title.includes(a.product_name.toLowerCase()) ||
                    a.product_name.toLowerCase().includes(title)
                );
                if (match) {
                    matches.push({ mapId: mapping.id, internalProductId: match.id });
                }
            }
            if (matches.length === 0) {
                toast.info('Otomatik eşleştirilebilecek ürün bulunamadı. Manuel eşleştirme yapın.');
            } else {
                await bulkMatchProducts(matches);
                toast.success(`${matches.length} ürün otomatik eşleştirildi!`);
                fetchData();
            }
        } catch {
            toast.error('Toplu eşleştirme sırasında hata oluştu.');
        } finally {
            setBulkMatching(false);
        }
    };

    const filteredMappings = mappings
        .filter(m => filter === 'all' || m.match_confidence === 'manual_required')
        .filter(m => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                (m.external_title?.toLowerCase().includes(q)) ||
                (m.merchant_sku?.toLowerCase().includes(q)) ||
                (m.barcode?.toLowerCase().includes(q)) ||
                m.external_product_id.toLowerCase().includes(q)
            );
        });

    const manualCount = mappings.filter(m => m.match_confidence === 'manual_required').length;

    const confidenceBadge = (c: string) => {
        switch (c) {
            case 'high':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Yüksek</span>;
            case 'medium':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400"><Link2 className="h-3 w-3" /> Orta</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400"><AlertTriangle className="h-3 w-3" /> Manuel Gerekli</span>;
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <Link href="/marketplace">
                                <Button variant="ghost" size="sm" className="gap-1">
                                    <ArrowLeft className="h-4 w-4" /> Geri
                                </Button>
                            </Link>
                            <h1 className="text-2xl font-bold tracking-tight">Eşleştirme Merkezi</h1>
                        </div>
                        <p className="text-muted-foreground text-sm ml-[76px]">
                            Trendyol ürünlerini Kârnet analizleriyle eşleştirin.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {manualCount > 0 && (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleBulkAutoMatch}
                                    disabled={bulkMatching || analyses.length === 0}
                                    className="gap-1.5"
                                >
                                    {bulkMatching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                                    Otomatik Eşleştir
                                </Button>
                                <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-500/10 text-red-400">
                                    {manualCount} eşleşmemiş
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Filter + Search */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex gap-2">
                        <Button
                            variant={filter === 'manual_required' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilter('manual_required')}
                        >
                            Eşleşmeyenler ({manualCount})
                        </Button>
                        <Button
                            variant={filter === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilter('all')}
                        >
                            Tümü ({mappings.length})
                        </Button>
                    </div>
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Ürün ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/60 bg-muted/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredMappings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <Search className="h-10 w-10 mb-3 opacity-40" />
                            <p className="font-medium">
                                {filter === 'manual_required' ? 'Tüm ürünler eşleşmiş! 🎉' : 'Henüz eşleştirme verisi yok.'}
                            </p>
                            <p className="text-xs mt-1">Önce Pazaryeri sayfasından ürünleri senkronlayın ve normalize edin.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <th className="text-left p-3 font-medium">Trendyol Ürün</th>
                                        <th className="text-left p-3 font-medium">SKU / Barcode</th>
                                        <th className="text-left p-3 font-medium">Güven</th>
                                        <th className="text-left p-3 font-medium">Kârnet Eşleştirme</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMappings.map((m) => (
                                        <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                            <td className="p-3 max-w-[250px]">
                                                <p className="font-medium truncate">{m.external_title || '—'}</p>
                                            </td>
                                            <td className="p-3">
                                                <p className="text-xs text-muted-foreground">
                                                    {m.merchant_sku && <span>SKU: {m.merchant_sku}</span>}
                                                    {m.merchant_sku && m.barcode && <span className="mx-1">·</span>}
                                                    {m.barcode && <span>BC: {m.barcode}</span>}
                                                    {!m.merchant_sku && !m.barcode && '—'}
                                                </p>
                                            </td>
                                            <td className="p-3">{confidenceBadge(m.match_confidence)}</td>
                                            <td className="p-3">
                                                <select
                                                    className="w-full rounded-md border px-2 py-1.5 text-sm bg-background"
                                                    value={m.internal_product_id || ''}
                                                    onChange={(e) => handleMatch(m.id, e.target.value)}
                                                    disabled={savingId === m.id}
                                                >
                                                    <option value="">— Seçiniz —</option>
                                                    {analyses.map((a) => (
                                                        <option key={a.id} value={a.id}>
                                                            {a.product_name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
