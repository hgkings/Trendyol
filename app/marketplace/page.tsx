'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Store,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Trash2,
    Eye,
    EyeOff,
    ShieldCheck,
    ExternalLink,
    RefreshCw,
    Package,
    ShoppingCart,
    Plug,
    Wand2,
    Link2,
    BarChart3,
    ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

type MarketplaceKey = 'trendyol' | 'hepsiburada';
type ConnectionStatus = 'disconnected' | 'connected' | 'pending_test' | 'error';

const MARKETPLACE_CONFIG: Record<MarketplaceKey, {
    label: string;
    color: string;
    gradient: string;
    iconBg: string;
    sellerIdLabel: string;
    helpText: string;
}> = {
    trendyol: {
        label: 'Trendyol',
        color: 'orange',
        gradient: 'from-orange-50/50 to-transparent dark:from-orange-950/20',
        iconBg: 'bg-orange-500 shadow-orange-500/20',
        sellerIdLabel: 'Satıcı ID',
        helpText: 'Trendyol Satıcı Paneli → Entegrasyon → API Bilgileri sayfasından API Key, API Secret ve Satıcı ID bilgilerinizi alabilirsiniz.',
    },
    hepsiburada: {
        label: 'Hepsiburada',
        color: 'purple',
        gradient: 'from-purple-50/50 to-transparent dark:from-purple-950/20',
        iconBg: 'bg-purple-600 shadow-purple-600/20',
        sellerIdLabel: 'Merchant ID',
        helpText: 'Hepsiburada Satıcı Paneli → Hesap Bilgileri → Entegrasyon Bilgileri sayfasından API Key, API Secret ve Merchant ID bilgilerinizi alabilirsiniz.',
    },
};

interface ConnectionState {
    connected: boolean;
    connection_id?: string;
    status: ConnectionStatus;
    store_name?: string;
    seller_id?: string;
    last_sync_at?: string;
}

export default function MarketplacePage() {
    const [selectedMarketplace, setSelectedMarketplace] = useState<MarketplaceKey>('trendyol');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [connection, setConnection] = useState<ConnectionState | null>(null);

    // Sync states
    const [testing, setTesting] = useState(false);
    const [syncingProducts, setSyncingProducts] = useState(false);
    const [syncingOrders, setSyncingOrders] = useState(false);
    const [lastLog, setLastLog] = useState<string | null>(null);
    const [normalizingOrders, setNormalizingOrders] = useState(false);
    const [orderMetrics, setOrderMetrics] = useState<{ currentMonthSales: number; unmatchedOrders: number; metricsUpdated: number } | null>(null);

    // Form fields
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [sellerId, setSellerId] = useState('');
    const [storeName, setStoreName] = useState('');

    // Show/hide password fields
    const [showApiKey, setShowApiKey] = useState(false);
    const [showApiSecret, setShowApiSecret] = useState(false);

    const mpConfig = MARKETPLACE_CONFIG[selectedMarketplace];
    const apiBase = `/api/marketplace/${selectedMarketplace}`;

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`/api/marketplace/${selectedMarketplace}`);
            if (res.ok) {
                const data = await res.json();
                setConnection(data);
            } else {
                setConnection(null);
            }
        } catch {
            setConnection(null);
        } finally {
            setLoading(false);
        }
    }, [selectedMarketplace]);

    useEffect(() => {
        setLoading(true);
        setConnection(null);
        setLastLog(null);
        setOrderMetrics(null);
        fetchStatus();
    }, [fetchStatus]);

    const handleSave = async () => {
        if (!apiKey.trim() || !apiSecret.trim()) {
            toast.error('API Key ve API Secret zorunludur.');
            return;
        }

        setSaving(true);
        setLastLog(null);
        try {
            const res = await fetch(apiBase, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: apiKey.trim(),
                    apiSecret: apiSecret.trim(),
                    sellerId: sellerId.trim() || undefined,
                    storeName: storeName.trim() || undefined,
                }),
            });

            const data = await res.json();

            if (res.ok && data.success && data.secrets_saved) {
                toast.success(`${mpConfig.label} bağlantısı ve güvenli anahtarlar başarıyla kaydedildi! ✅`);
                setLastLog('Bağlantı ve anahtarlar kaydedildi.');
                setApiKey('');
                setApiSecret('');
                setSellerId('');
                setStoreName('');
                fetchStatus();
            } else if (res.ok && data.success && !data.secrets_saved) {
                toast.warning('Bağlantı oluşturuldu ancak güvenli anahtar kaydı doğrulanamadı. Tekrar deneyin.');
                setLastLog('Anahtar doğrulama başarısız.');
                fetchStatus();
            } else {
                // Error — show specific message per error_code
                const codeMap: Record<string, string> = {
                    secrets_write_failed: 'Güvenli anahtar kaydı başarısız. DB policy veya service role kontrol edin.',
                    secrets_verify_failed: 'Anahtar yazılmış gibi görünüyor ama doğrulanamadı.',
                    encryption_key_missing: 'Sunucu şifreleme anahtarı (MARKETPLACE_SECRET_KEY) ayarlanmamış.',
                    service_role_missing: 'SUPABASE_SERVICE_ROLE_KEY ayarlanmamış.',
                    encryption_failed: 'Şifreleme başarısız — anahtar formatı hatalı olabilir.',
                    connection_upsert_failed: 'Bağlantı kaydı oluşturulamadı.',
                };
                const friendlyMsg = codeMap[data.error_code] || data.error || 'Bilinmeyen hata.';
                toast.error(friendlyMsg);
                setLastLog(`Hata [${data.error_code || 'unknown'}]: ${data.error || friendlyMsg}${data.debug ? ` | PG: ${data.debug.pg_code} - ${data.debug.pg_message}` : ''}`);
            }
        } catch {
            toast.error('Sunucu hatası oluştu.');
        } finally {
            setSaving(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm(`${mpConfig.label} bağlantısını kaldırmak istediğinize emin misiniz? Tüm API bilgileri silinecektir.`)) return;

        setDisconnecting(true);
        try {
            const res = await fetch(apiBase, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(`${mpConfig.label} bağlantısı kaldırıldı.`);
                fetchStatus();
            } else {
                toast.error(data.error || 'Bağlantı kaldırılamadı.');
            }
        } catch {
            toast.error('Sunucu hatası oluştu.');
        } finally {
            setDisconnecting(false);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        setLastLog(null);
        try {
            const res = await fetch(`${apiBase}/test`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'Bağlantı başarılı!');
                setLastLog(data.message);
            } else {
                toast.error(data.message || data.error || 'Bağlantı testi başarısız.');
                setLastLog(data.message || data.error);
            }
            fetchStatus();
        } catch {
            toast.error('Bağlantı testi sırasında hata oluştu.');
        } finally {
            setTesting(false);
        }
    };

    const handleSyncProducts = async () => {
        setSyncingProducts(true);
        setLastLog(null);
        try {
            const res = await fetch(`${apiBase}/sync-products`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'Ürünler senkronize edildi!');
                setLastLog(data.message);
            } else {
                toast.error(data.error || 'Ürün senkronizasyonu başarısız.');
                setLastLog(data.error);
            }
            fetchStatus();
        } catch {
            toast.error('Ürün senkronizasyonu sırasında hata oluştu.');
        } finally {
            setSyncingProducts(false);
        }
    };

    const handleSyncOrders = async () => {
        setSyncingOrders(true);
        setLastLog(null);
        try {
            const res = await fetch(`${apiBase}/sync-orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'Siparişler senkronize edildi!');
                setLastLog(data.message);
            } else {
                toast.error(data.error || 'Sipariş senkronizasyonu başarısız.');
                setLastLog(data.error);
            }
            fetchStatus();
        } catch {
            toast.error('Sipariş senkronizasyonu sırasında hata oluştu.');
        } finally {
            setSyncingOrders(false);
        }
    };

    const isConnected = connection?.status === 'connected';
    const [normalizing, setNormalizing] = useState(false);
    const isSyncing = syncingProducts || syncingOrders || testing || normalizing || normalizingOrders;

    const handleNormalizeOrders = async () => {
        setNormalizingOrders(true);
        setLastLog(null);
        try {
            const res = await fetch(`${apiBase}/normalize-orders`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'Sipariş metrikleri güncellendi!');
                setLastLog(data.message);
                setOrderMetrics({ currentMonthSales: data.currentMonthSales, unmatchedOrders: data.unmatchedOrders, metricsUpdated: data.metricsUpdated });
            } else {
                toast.error(data.error || 'Sipariş normalizasyonu başarısız.');
                setLastLog(data.error);
            }
            fetchStatus();
        } catch {
            toast.error('Sipariş normalizasyonu sırasında hata oluştu.');
        } finally {
            setNormalizingOrders(false);
        }
    };



    const handleNormalize = async () => {
        setNormalizing(true);
        setLastLog(null);
        try {
            const res = await fetch(`${apiBase}/normalize`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'Veriler normalize edildi!');
                setLastLog(data.message);
            } else {
                toast.error(data.error || 'Normalizasyon başarısız.');
                setLastLog(data.error);
            }
            fetchStatus();
        } catch {
            toast.error('Normalizasyon sırasında hata oluştu.');
        } finally {
            setNormalizing(false);
        }
    };

    const statusConfig: Record<ConnectionStatus, { icon: React.ReactNode; label: string; color: string }> = {
        connected: {
            icon: <CheckCircle2 className="h-5 w-5" />,
            label: 'Bağlı',
            color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
        },
        disconnected: {
            icon: <XCircle className="h-5 w-5" />,
            label: 'Bağlı Değil',
            color: 'text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-700',
        },
        pending_test: {
            icon: <Loader2 className="h-5 w-5 animate-spin" />,
            label: 'Test Ediliyor',
            color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
        },
        error: {
            icon: <AlertTriangle className="h-5 w-5" />,
            label: 'Hata',
            color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800',
        },

    };

    const currentStatus = statusConfig[connection?.status || 'disconnected'] || statusConfig.disconnected;

    return (
        <DashboardLayout>
            <div className="space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Pazaryeri Bağlantıları</h1>
                    <p className="text-muted-foreground mt-1">
                        Pazaryeri hesaplarınızı bağlayarak ürün ve sipariş verilerinizi otomatik senkronize edin.
                    </p>
                </div>

                {/* Marketplace Card */}
                <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                    {/* Card Header */}
                    <div className={`flex items-center justify-between p-6 border-b bg-gradient-to-r ${mpConfig.gradient}`}>
                        <div className="flex items-center gap-4">
                            <div className={`flex items-center justify-center w-12 h-12 rounded-xl text-white shadow-lg ${mpConfig.iconBg}`}>
                                <Store className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="relative inline-block">
                                    <select
                                        value={selectedMarketplace}
                                        onChange={(e) => setSelectedMarketplace(e.target.value as MarketplaceKey)}
                                        className="text-lg font-bold appearance-none bg-transparent pr-7 cursor-pointer focus:outline-none"
                                    >
                                        <option value="trendyol">Trendyol</option>
                                        <option value="hepsiburada">Hepsiburada</option>
                                    </select>
                                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">Pazaryeri entegrasyonu</p>
                            </div>
                        </div>

                        {/* Status Badge */}
                        {!loading && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${currentStatus.color}`}>
                                {currentStatus.icon}
                                <span>{currentStatus.label}</span>
                            </div>
                        )}
                    </div>

                    {/* Card Body */}
                    <div className="p-6">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : isConnected ? (
                            /* ─── Connected State ─── */
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="rounded-lg border p-4 space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mağaza Adı</p>
                                        <p className="text-sm font-semibold truncate">{connection?.store_name || '—'}</p>
                                    </div>
                                    <div className="rounded-lg border p-4 space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Satıcı ID</p>
                                        <p className="text-sm font-semibold truncate">{connection?.seller_id || '—'}</p>
                                    </div>
                                    <div className="rounded-lg border p-4 space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Son Senkronizasyon</p>
                                        <p className="text-sm font-semibold">
                                            {connection?.last_sync_at
                                                ? new Date(connection.last_sync_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                : 'Henüz yok'}
                                        </p>
                                    </div>
                                </div>

                                {/* Security Notice */}
                                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
                                    <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                    <div className="text-xs text-emerald-700 dark:text-emerald-300">
                                        <p className="font-semibold">API bilgileriniz güvende</p>
                                        <p className="mt-0.5 opacity-80">Tüm kimlik bilgileri AES-256-GCM ile şifreli olarak saklanır. Hiçbir zaman düz metin olarak depolanmaz.</p>
                                    </div>
                                </div>

                                {/* Sync Actions */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <Button variant="outline" onClick={handleTestConnection} disabled={isSyncing} className="gap-2 h-12">
                                        {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                                        Bağlantıyı Test Et
                                    </Button>
                                    <Button variant="outline" onClick={handleSyncProducts} disabled={isSyncing} className="gap-2 h-12">
                                        {syncingProducts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                                        Ürünleri Senkronla
                                    </Button>
                                    <Button variant="outline" onClick={handleSyncOrders} disabled={isSyncing} className="gap-2 h-12">
                                        {syncingOrders ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                                        Siparişleri Senkronla
                                    </Button>
                                </div>

                                {/* Normalize & Match Actions */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Button variant="outline" onClick={handleNormalize} disabled={isSyncing} className="gap-2 h-12">
                                        {normalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                                        Ürünleri Kârnet'e Aktar
                                    </Button>
                                    <Link href="/marketplace/matching">
                                        <Button variant="outline" className="gap-2 h-12 w-full">
                                            <Link2 className="h-4 w-4" />
                                            Eşleştirme Merkezi
                                        </Button>
                                    </Link>
                                </div>

                                {/* Order Metrics Actions */}
                                <div className="grid grid-cols-1 gap-3">
                                    <Button variant="outline" onClick={handleNormalizeOrders} disabled={isSyncing} className="gap-2 h-12">
                                        {normalizingOrders ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                                        Siparişleri İşle (Metrik Üret)
                                    </Button>
                                </div>

                                {/* Metrics Panel */}
                                {orderMetrics && (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 p-4 space-y-1">
                                            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Bu Ay Satış</p>
                                            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{orderMetrics.currentMonthSales}</p>
                                        </div>
                                        <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-4 space-y-1">
                                            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Eşleşmeyen Sipariş</p>
                                            <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{orderMetrics.unmatchedOrders}</p>
                                        </div>
                                        <div className="rounded-lg border p-4 space-y-1">
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Metrik Güncelleme</p>
                                            <p className="text-xl font-bold">{orderMetrics.metricsUpdated}</p>
                                        </div>
                                    </div>
                                )}


                                {/* Last Log */}
                                {lastLog && (
                                    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                                        <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <p className="text-xs text-muted-foreground truncate">{lastLog}</p>
                                    </div>
                                )}

                                {/* Disconnect Button */}
                                <div className="flex justify-end">
                                    <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting || isSyncing} className="gap-2">
                                        {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        Bağlantıyı Kaldır
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            /* ─── Disconnected State — Show Form ─── */
                            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
                                {/* Info Banner */}
                                <div className="flex items-start gap-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4">
                                    <ExternalLink className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                    <div className="text-xs text-blue-700 dark:text-blue-300">
                                        <p className="font-semibold">API bilgilerinizi nereden bulabilirsiniz?</p>
                                        <p className="mt-0.5 opacity-80">
                                            {mpConfig.helpText}
                                        </p>
                                    </div>
                                </div>

                                {/* Form */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    {/* API Key */}
                                    <div className="space-y-2">
                                        <Label htmlFor="apiKey" className="text-sm font-medium">
                                            API Key <span className="text-red-500">*</span>
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="apiKey"
                                                type={showApiKey ? 'text' : 'password'}
                                                placeholder="API Key giriniz"
                                                value={apiKey}
                                                onChange={(e) => setApiKey(e.target.value)}
                                                className="pr-10"
                                                autoComplete="off"
                                            />
                                            <button
                                                type="button"
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                onClick={() => setShowApiKey(!showApiKey)}
                                            >
                                                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* API Secret */}
                                    <div className="space-y-2">
                                        <Label htmlFor="apiSecret" className="text-sm font-medium">
                                            API Secret <span className="text-red-500">*</span>
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="apiSecret"
                                                type={showApiSecret ? 'text' : 'password'}
                                                placeholder="API Secret giriniz"
                                                value={apiSecret}
                                                onChange={(e) => setApiSecret(e.target.value)}
                                                className="pr-10"
                                                autoComplete="off"
                                            />
                                            <button
                                                type="button"
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                onClick={() => setShowApiSecret(!showApiSecret)}
                                            >
                                                {showApiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Seller / Merchant ID */}
                                    <div className="space-y-2">
                                        <Label htmlFor="sellerId" className="text-sm font-medium">
                                            {mpConfig.sellerIdLabel} <span className="text-muted-foreground text-xs">(opsiyonel)</span>
                                        </Label>
                                        <Input
                                            id="sellerId"
                                            type="text"
                                            placeholder={`${mpConfig.sellerIdLabel} giriniz`}
                                            value={sellerId}
                                            onChange={(e) => setSellerId(e.target.value)}
                                            autoComplete="off"
                                        />
                                    </div>

                                    {/* Store Name */}
                                    <div className="space-y-2">
                                        <Label htmlFor="storeName" className="text-sm font-medium">
                                            Mağaza Adı <span className="text-muted-foreground text-xs">(opsiyonel)</span>
                                        </Label>
                                        <Input
                                            id="storeName"
                                            type="text"
                                            placeholder="Ör: Mağazam"
                                            value={storeName}
                                            onChange={(e) => setStoreName(e.target.value)}
                                            autoComplete="off"
                                        />
                                    </div>
                                </div>

                                {/* Security Notice */}
                                <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
                                    <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-muted-foreground">
                                        API bilgileriniz AES-256-GCM ile şifrelenerek güvenli sunucularımızda saklanır.
                                        Bilgileriniz hiçbir zaman tarayıcınızda depolanmaz veya loglara yazılmaz.
                                    </p>
                                </div>

                                {/* Save Button */}
                                <div className="flex justify-end">
                                    <Button type="submit" disabled={saving || !apiKey || !apiSecret} className="gap-2 min-w-[200px]">
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
                                        Kaydet & Bağlantıyı Test Et
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout >
    );
}
