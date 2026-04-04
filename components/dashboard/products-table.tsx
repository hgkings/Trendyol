'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Analysis } from '@/types';
import { getMarketplaceLabel } from '@/lib/marketplace-data';
import { formatCurrency, formatPercent } from '@/components/shared/format';
import { RiskBadge } from '@/components/shared/risk-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Eye,
  Trash2,
  Pencil,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface StockItem {
  barcode: string;
  quantity: number;
  salePrice: number;
  imageUrl: string | null;
  productUrl: string | null;
}

interface ProductsTableProps {
  analyses: Analysis[];
  onDelete?: (id: string) => void;
  stockMap?: Map<string, StockItem>;
}

type SortField = 'monthly_net_profit' | 'margin_pct' | 'risk_score' | 'created_at';
type SortOrder = 'asc' | 'desc';

export function ProductsTable({ analyses, onDelete, stockMap }: ProductsTableProps) {
  // --- States ---
  const [searchTerm, setSearchTerm] = useState('');
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // profitable, loss, pareto_80

  const [sortField, setSortField] = useState<SortField>('monthly_net_profit');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // --- Derived Data ---
  const filteredAndSortedData = useMemo(() => {
    let data = [...analyses];

    // 1. Search
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(a =>
        a.input.product_name.toLowerCase().includes(lower) ||
        getMarketplaceLabel(a.input.marketplace).toLowerCase().includes(lower)
      );
    }

    // 2. Filters
    if (marketplaceFilter !== 'all') {
      data = data.filter(a => a.input.marketplace === marketplaceFilter);
    }
    if (riskFilter !== 'all') {
      data = data.filter(a => a.risk.level === riskFilter);
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'profitable') {
        data = data.filter(a => a.result.monthly_net_profit > 0);
      } else if (statusFilter === 'loss') {
        data = data.filter(a => a.result.monthly_net_profit <= 0);
      } else if (statusFilter === 'pareto_80') {
        // Pareto Logic: Top 80% contributors
        const profitable = [...analyses].filter(a => a.result.monthly_net_profit > 0)
          .sort((a, b) => b.result.monthly_net_profit - a.result.monthly_net_profit);
        const totalProfit = profitable.reduce((sum, a) => sum + a.result.monthly_net_profit, 0);
        const threshold = totalProfit * 0.8;
        let currentSum = 0;
        const topIds = new Set<string>();

        for (const p of profitable) {
          currentSum += p.result.monthly_net_profit;
          topIds.add(p.id);
          if (currentSum >= threshold) break;
        }
        data = data.filter(a => topIds.has(a.id));
      }
    }

    // 3. Sort
    data.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (sortField) {
        case 'monthly_net_profit':
          valA = a.result.monthly_net_profit;
          valB = b.result.monthly_net_profit;
          break;
        case 'margin_pct':
          valA = a.result.margin_pct;
          valB = b.result.margin_pct;
          break;
        case 'risk_score':
          valA = a.risk.score;
          valB = b.risk.score;
          break;
        case 'created_at':
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [analyses, searchTerm, marketplaceFilter, riskFilter, statusFilter, sortField, sortOrder]);

  // 4. Pagination
  const totalItems = filteredAndSortedData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // --- Render Helpers ---
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
    return (
      <ArrowUpDown className={cn(
        "ml-1 h-3 w-3 transition-transform",
        sortOrder === 'desc' ? "text-primary" : "text-primary rotate-180"
      )} />
    );
  };

  if (analyses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card p-12 text-center">
        <div className="rounded-full bg-primary/10 p-4 mb-4">
          <Search className="h-8 w-8 text-primary/60" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Henüz ürün analizi yok</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          İlk ürününüzü analiz ederek karlılık durumunu ve risk raporunu görebilirsiniz.
        </p>
        <Link href="/analysis/new">
          <Button className="mt-6 rounded-xl h-11 px-8 hover:scale-105 transition-transform">
            Yeni Analiz Başlat
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* --- Toolbar --- */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-xl border border-border/40">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ürün adı veya pazaryeri ara..."
            className="pl-9 h-10 bg-muted/20 border-transparent focus:border-amber-500/20 focus:bg-muted/30 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={marketplaceFilter} onValueChange={(v) => { setMarketplaceFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="h-9 w-full sm:w-[140px] text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                <SelectValue placeholder="Pazaryeri" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Pazaryerleri</SelectItem>
              <SelectItem value="trendyol">Trendyol</SelectItem>
              <SelectItem value="hepsiburada">Hepsiburada</SelectItem>
              <SelectItem value="amazon_tr">Amazon TR</SelectItem>
              <SelectItem value="n11">N11</SelectItem>
            </SelectContent>
          </Select>

          <Select value={riskFilter} onValueChange={(v) => { setRiskFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="h-9 w-full sm:w-[130px] text-xs">
              <SelectValue placeholder="Risk Durumu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Riskler</SelectItem>
              <SelectItem value="safe">Güvenli</SelectItem>
              <SelectItem value="moderate">Orta Risk</SelectItem>
              <SelectItem value="risky">Riskli</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="h-9 w-full sm:w-[130px] text-xs">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="profitable">Kârlı Ürünler</SelectItem>
              <SelectItem value="loss">Zarar Edenler</SelectItem>
              <SelectItem value="pareto_80">⭐ Kârın Omurgası (80/20)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* --- Mobile Card View --- */}
      <div className="md:hidden space-y-2">
        {paginatedData.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Sonuç bulunamadı.
            <Button variant="link" size="sm" onClick={() => { setSearchTerm(''); setMarketplaceFilter('all'); setRiskFilter('all'); setStatusFilter('all'); setCurrentPage(1); }}>Filtreleri Temizle</Button>
          </div>
        ) : (
          paginatedData.map((a) => {
            const inputs = a.input as unknown as Record<string, unknown>;
            const barcode = (inputs.barcode as string) ?? '';
            const sku = (inputs.merchant_sku as string) ?? '';
            const stock = stockMap?.get(barcode) ?? stockMap?.get(sku) ?? stockMap?.get(a.input.product_name.toLowerCase());
            const imgUrl = stock?.imageUrl ?? (inputs.image_url as string | undefined);
            const stok = stock?.quantity ?? (inputs.stock_quantity as number | undefined);

            return (
            <div key={a.id} className="rounded-xl border border-border/40 bg-card p-3.5 space-y-2.5">
              <div className="flex items-start gap-3">
                {imgUrl ? (
                  <img src={imgUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-border/30 shrink-0 bg-muted/20" loading="lazy" />
                ) : (
                  <div className="w-12 h-12 rounded-lg border border-border/30 shrink-0 bg-muted/20 flex items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground/30" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {stock?.productUrl ? (
                    <a href={stock.productUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      <span className="font-semibold text-sm block truncate">{a.input.product_name}</span>
                    </a>
                  ) : (
                    <Link href={`/analysis/${a.id}`} className="hover:underline">
                      <span className="font-semibold text-sm block truncate">{a.input.product_name}</span>
                    </Link>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] bg-muted/30 px-1.5 py-0.5 rounded text-muted-foreground">
                      {getMarketplaceLabel(a.input.marketplace)}
                    </span>
                    {typeof stok === 'number' && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        stok <= 0 ? 'bg-red-500/10 text-red-500' :
                        stok <= 5 ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' :
                        'bg-muted/30 text-muted-foreground'
                      }`}>
                        Stok: {stok}
                      </span>
                    )}
                  </div>
                </div>
                <RiskBadge level={a.risk.level} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Birim Kar</span>
                  <span className={`text-sm font-bold tabular-nums ${a.result.unit_net_profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(a.result.unit_net_profit)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Marj</span>
                  <span className={`text-sm font-bold tabular-nums ${a.result.margin_pct >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
                    {formatPercent(a.result.margin_pct)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Aylik Kar</span>
                  <span className={`text-sm font-bold tabular-nums ${a.result.monthly_net_profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(a.result.monthly_net_profit)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-end pt-2 border-t border-border/30">
                <div className="flex items-center gap-1">
                  <Link href={`/analysis/${a.id}`}>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                  </Link>
                  {onDelete && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => onDelete(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )})
        )}
      </div>

      {/* --- Desktop Table --- */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-border/40 bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/10 text-[11px] uppercase tracking-wider text-muted-foreground/70">
                <th
                  className="px-4 py-3.5 text-left font-semibold cursor-pointer select-none group"
                  onClick={() => handleSort('monthly_net_profit')} // Default/Custom logic
                >
                  Ürün Detayı
                </th>
                <th className="hidden px-4 py-3.5 text-left font-semibold sm:table-cell">Pazaryeri</th>

                <th
                  className="px-4 py-3.5 text-right font-semibold cursor-pointer select-none group"
                  onClick={() => handleSort('monthly_net_profit')}
                >
                  <div className="flex items-center justify-end gap-1 group-hover:text-foreground transition-colors">
                    Birim Kâr
                  </div>
                </th>

                <th
                  className="hidden px-4 py-3.5 text-right font-semibold md:table-cell cursor-pointer select-none group"
                  onClick={() => handleSort('margin_pct')}
                >
                  <div className="flex items-center justify-end gap-1 group-hover:text-foreground transition-colors">
                    Marj <SortIcon field="margin_pct" />
                  </div>
                </th>

                <th
                  className="hidden px-4 py-3.5 text-right font-semibold lg:table-cell cursor-pointer select-none group"
                  onClick={() => handleSort('monthly_net_profit')}
                >
                  <div className="flex items-center justify-end gap-1 group-hover:text-foreground transition-colors">
                    Aylık Kâr <SortIcon field="monthly_net_profit" />
                  </div>
                </th>

                <th
                  className="px-4 py-3.5 text-center font-semibold cursor-pointer select-none group"
                  onClick={() => handleSort('risk_score')}
                >
                  <div className="flex items-center justify-center gap-1 group-hover:text-foreground transition-colors">
                    Risk <SortIcon field="risk_score" />
                  </div>
                </th>
                <th className="px-4 py-3.5 text-right font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y relative">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="h-32 text-center text-muted-foreground">
                    Sonuç bulunamadı.
                    <Button variant="link" onClick={() => {
                      setSearchTerm('');
                      setMarketplaceFilter('all');
                      setRiskFilter('all');
                    }}>Filtreleri Temizle</Button>
                  </td>
                </tr>
              ) : (
                paginatedData.map((a) => {
                  const inputs = a.input as unknown as Record<string, unknown>;
                  const barcode = (inputs.barcode as string) ?? '';
                  const sku = (inputs.merchant_sku as string) ?? '';
                  const stock = stockMap?.get(barcode) ?? stockMap?.get(sku) ?? stockMap?.get(a.input.product_name.toLowerCase());
                  const imgUrl = stock?.imageUrl ?? (inputs.image_url as string | undefined);
                  const stok = stock?.quantity ?? (inputs.stock_quantity as number | undefined);

                  return (
                  <tr key={a.id} className="transition-colors hover:bg-muted/10 group">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        {imgUrl ? (
                          <img src={imgUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-border/30 shrink-0 bg-muted/20" loading="lazy" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg border border-border/30 shrink-0 bg-muted/20 flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          {stock?.productUrl ? (
                            <a href={stock.productUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground truncate max-w-[180px] sm:max-w-xs hover:text-primary hover:underline transition-colors">{a.input.product_name}</a>
                          ) : (
                            <Link href={`/analysis/${a.id}`} className="font-semibold text-foreground truncate max-w-[180px] sm:max-w-xs hover:text-primary hover:underline transition-colors">{a.input.product_name}</Link>
                          )}
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(a.createdAt).toLocaleDateString('tr-TR')}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 sm:hidden">
                        <span className="inline-flex items-center rounded-md bg-muted/30 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                          {getMarketplaceLabel(a.input.marketplace)}
                        </span>
                      </div>

                      {/* Health Tags */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {a.result.margin_pct >= 20 && (a.risk.level === 'safe' || a.risk.level === 'moderate') && (
                          <span className="inline-flex items-center rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                            ⭐ Yıldız
                          </span>
                        )}
                        {a.result.monthly_net_profit > 0 && (a.result.margin_pct < 10 || a.risk.level === 'risky' || a.risk.level === 'dangerous') && (
                          <span className="inline-flex items-center rounded-sm bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-400">
                            ⚠️ İnce Çizgi
                          </span>
                        )}
                        {a.result.monthly_net_profit <= 0 && (
                          <span className="inline-flex items-center rounded-sm bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                            Zarar
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3.5 sm:table-cell">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center rounded-full bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border/40">
                          {getMarketplaceLabel(a.input.marketplace)}
                        </span>
                        {typeof stok === 'number' && (
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                            stok <= 0
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                              : stok <= 10
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                : 'bg-muted/30 text-muted-foreground'
                          )}>
                            Stok: {stok}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-3.5 text-right font-bold tabular-nums ${a.result.unit_net_profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(a.result.unit_net_profit)}
                    </td>
                    <td className={`hidden px-4 py-3.5 text-right font-bold tabular-nums md:table-cell ${a.result.margin_pct >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
                      {formatPercent(a.result.margin_pct)}
                    </td>
                    <td className={`hidden px-4 py-3.5 text-right font-bold tabular-nums lg:table-cell ${a.result.monthly_net_profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(a.result.monthly_net_profit)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <RiskBadge level={a.risk.level} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {/* Desktop Actions */}
                      <div className="hidden sm:flex items-center justify-end gap-1">
                        <Link href={`/analysis/${a.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors" title="Görüntüle">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/analysis/${a.id}/edit`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors" title="Düzenle">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                            onClick={() => onDelete(a.id)}
                            title="Sil"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {/* Mobile Actions (Dropdown) */}
                      <div className="sm:hidden">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <Link href={`/analysis/${a.id}`}>
                              <DropdownMenuItem>Görüntüle</DropdownMenuItem>
                            </Link>
                            <Link href={`/analysis/${a.id}/edit`}>
                              <DropdownMenuItem>Düzenle</DropdownMenuItem>
                            </Link>
                            {onDelete && (
                              <DropdownMenuItem onClick={() => onDelete(a.id)} className="text-destructive focus:text-destructive">
                                Sil
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* --- Pagination (shared between mobile & desktop) --- */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border/40 bg-card">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Satir:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(v) => {
                setItemsPerPage(Number(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-7 w-[60px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
