'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PRICING } from '@/config/pricing';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Sun,
    Moon,
    Monitor,
    Bell,
    Shield,
    Database,
    LogOut,
    Store,
    Key,
    Mail,
    Download,
    Trash2,
    AlertTriangle,
    CheckCircle2,
    Settings,
    Crown,
    CreditCard,
    ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { deleteAnalysis, getStoredAnalyses } from '@/lib/api/analyses';
import { analysesToCSV, analysesToJSON } from '@/lib/csv';
import { createClient } from '@/lib/supabase/client';
import { isProUser } from '@/utils/access';
import { useRouter } from 'next/navigation';
import type { Marketplace, Analysis } from '@/types';

const MARKETPLACE_OPTIONS: { key: Marketplace; label: string }[] = [
    { key: 'trendyol', label: 'Trendyol' },
    { key: 'hepsiburada', label: 'Hepsiburada' },
    { key: 'amazon_tr', label: 'Amazon TR' },
    { key: 'n11', label: 'N11' },
    { key: 'custom', label: 'Diğer' },
];

export default function SettingsPage() {
    const { user, logout, updateProfile } = useAuth();
    const { theme, setTheme } = useTheme();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const isPro = isProUser(user);

    // — Delete dialog —
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);

    // — Billing —
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

    // — Notifications (tercihli) —
    const [weeklyReport, setWeeklyReport] = useState(user?.email_weekly_report !== false);
    const [riskAlert, setRiskAlert] = useState(user?.email_risk_alert !== false);
    const [marginAlert, setMarginAlert] = useState(user?.email_margin_alert !== false);
    const [proExpiry, setProExpiry] = useState(user?.email_pro_expiry !== false);

    // — Analysis Defaults —
    const [defaultMp, setDefaultMp] = useState<Marketplace>(user?.default_marketplace ?? 'trendyol');
    const [defaultCommission, setDefaultCommission] = useState(user?.default_commission ?? 12);
    const [defaultVat, setDefaultVat] = useState(user?.default_vat ?? 20);
    const [defaultReturn, setDefaultReturn] = useState(user?.default_return_rate ?? 5);
    const [defaultAds, setDefaultAds] = useState(user?.default_ads_cost ?? 0);
    const [saving, setSaving] = useState(false);

    // — Auth providers —
    const [providers, setProviders] = useState<string[]>([]);

    // — Password change —
    const [newPassword, setNewPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

    // — Export —
    const [analyses, setAnalyses] = useState<Analysis[]>([]);

    useEffect(() => setMounted(true), []);

    // Seed state from user
    useEffect(() => {
        if (user) {
            setWeeklyReport(user.email_weekly_report !== false);
            setRiskAlert(user.email_risk_alert !== false);
            setMarginAlert(user.email_margin_alert !== false);
            setProExpiry(user.email_pro_expiry !== false);
            setDefaultMp(user.default_marketplace ?? 'trendyol');
            setDefaultCommission(user.default_commission ?? 12);
            setDefaultVat(user.default_vat ?? 20);
            setDefaultReturn(user.default_return_rate ?? 5);
            setDefaultAds(user.default_ads_cost ?? 0);
        }
    }, [user]);

    // Load analyses & providers
    useEffect(() => {
        if (!user) return;
        (async () => {
            const data = await getStoredAnalyses();
            setAnalyses(data);
        })();
        (async () => {
            const supabase = createClient();
            const { data } = await supabase.auth.getUser();
            if (data?.user?.app_metadata?.providers) {
                setProviders(data.user.app_metadata.providers);
            } else if (data?.user?.app_metadata?.provider) {
                setProviders([data.user.app_metadata.provider]);
            }
        })();
    }, [user]);

    // Save helper
    const save = useCallback(async (updates: Record<string, any>, successMsg = 'Kaydedildi.') => {
        if (!user) return;
        setSaving(true);
        const res = await updateProfile(updates);
        if (res.success) {
            toast.success(successMsg);
        } else {
            toast.error(res.error || 'Bir hata oluştu.');
        }
        setSaving(false);
    }, [user, updateProfile]);

    // Delete all data
    const handleDeleteAll = async () => {
        if (!user) return;
        setDeleting(true);
        try {
            const all = await getStoredAnalyses();
            await Promise.all(all.map((a) => deleteAnalysis(a.id)));
            setAnalyses([]);
            toast.success('Tüm analiz verileri silindi.');
            setDeleteDialogOpen(false);
            setDeleteConfirmText('');
        } catch {
            toast.error('Silme sırasında hata oluştu.');
        } finally {
            setDeleting(false);
        }
    };

    // Export helpers
    const downloadFile = (content: string, filename: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportCSV = () => {
        if (analyses.length === 0) {
            toast.error('Dışa aktarılacak analiz yok.');
            return;
        }
        downloadFile(analysesToCSV(analyses), 'karnet-analizler.csv', 'text/csv;charset=utf-8');
        toast.success('CSV dışa aktarıldı.');
    };

    const handleExportJSON = () => {
        if (analyses.length === 0) {
            toast.error('Dışa aktarılacak analiz yok.');
            return;
        }
        downloadFile(analysesToJSON(analyses), 'karnet-analizler.json', 'application/json');
        toast.success('JSON dışa aktarıldı.');
    };

    // Password change
    const handlePasswordChange = async () => {
        if (newPassword.length < 6) {
            toast.error('Şifre en az 6 karakter olmalıdır.');
            return;
        }
        setPasswordLoading(true);
        const supabase = createClient();
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
            toast.error(`Hata: ${error.message}`);
        } else {
            toast.success('Şifre başarıyla değiştirildi.');
            setNewPassword('');
        }
        setPasswordLoading(false);
    };

    if (!user) return null;

    const themeOptions = [
        { key: 'light', label: 'Açık', icon: Sun, desc: 'Aydınlık tema' },
        { key: 'dark', label: 'Koyu', icon: Moon, desc: 'Karanlık tema' },
        { key: 'system', label: 'Sistem', icon: Monitor, desc: 'Cihaz ayarı' },
    ];

    return (
        <DashboardLayout>
            <div className="mx-auto max-w-3xl space-y-8 pb-12">

                {/* Page Header */}
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <Settings className="h-5 w-5 text-muted-foreground" />
                        <h1 className="text-2xl font-bold tracking-tight">Ayarlar</h1>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Görünüm, bildirim, analiz varsayılanları ve güvenlik tercihlerinizi yönetin.
                    </p>
                </div>

                {/* ─── 1. Appearance ─── */}
                <section className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                            <Sun className="h-5 w-5 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="font-semibold">Görünüm</h2>
                            <p className="text-xs text-muted-foreground">Tema tercihini seçin.</p>
                        </div>
                    </div>

                    {mounted && (
                        <div className="grid grid-cols-3 gap-3">
                            {themeOptions.map((opt) => {
                                const active = theme === opt.key;
                                return (
                                    <button
                                        key={opt.key}
                                        onClick={() => setTheme(opt.key)}
                                        className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${active
                                            ? 'border-amber-500/50 bg-amber-500/10'
                                            : 'border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] hover:bg-white/5 hover:border-[rgba(255,255,255,0.12)]'
                                            }`}
                                    >
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${active ? 'bg-amber-500/10' : 'bg-[rgba(255,255,255,0.06)]'
                                            }`}>
                                            <opt.icon className={`h-5 w-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                                        </div>
                                        <span className={`text-sm font-medium ${active ? 'text-primary' : 'text-foreground'}`}>
                                            {opt.label}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                                        {active && (
                                            <div className="absolute top-2 right-2">
                                                <CheckCircle2 className="h-4 w-4 text-primary" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* ─── 2. Plan & Billing ─── */}
                <section className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                <Crown className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="font-semibold">Plan & Faturalandırma</h2>
                                <p className="text-xs text-muted-foreground">Mevcut planınızı ve ödeme detaylarınızı yönetin.</p>
                            </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${isPro ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.4)]'
                            }`}>
                            {isPro ? 'Pro Aktif' : 'Ücretsiz Plan'}
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Plan Details */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Plan Avantajları</p>
                                <ul className="space-y-2">
                                    {[
                                        { label: 'Sınırsız Analiz Geçmişi', active: isPro },
                                        { label: 'CSV İnceleme & Dışa Aktar', active: isPro },
                                        { label: 'Pazaryeri Karşılaştırma', active: isPro },
                                        { label: 'Gelişmiş Risk Analizi', active: isPro },
                                        { label: 'E-posta Bildirimleri', active: true },
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-center gap-2 text-xs">
                                            <CheckCircle2 className={`h-3.5 w-3.5 ${item.active ? 'text-emerald-500' : 'text-muted-foreground opacity-30'}`} />
                                            <span className={item.active ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <Button
                                onClick={() => router.push('/pricing')}
                                className="w-full gap-2 rounded-xl"
                            >
                                {isPro ? 'Planı Yönet' : 'Pro\'ya Geç'}
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Pricing UI (Optional Toggle) */}
                        {!isPro && (
                            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium">Fiyatlandırma</span>
                                    <div className="flex items-center gap-1 bg-[rgba(255,255,255,0.04)] p-0.5 rounded-lg border border-[rgba(255,255,255,0.06)]">
                                        <button
                                            onClick={() => setBillingCycle('monthly')}
                                            className={`px-2 py-1 text-[10px] rounded-md transition-all ${billingCycle === 'monthly' ? 'bg-[rgba(255,255,255,0.08)] text-foreground' : 'text-[rgba(255,255,255,0.4)]'}`}
                                        >
                                            Aylık
                                        </button>
                                        <button
                                            onClick={() => setBillingCycle('yearly')}
                                            className={`px-2 py-1 text-[10px] rounded-md transition-all ${billingCycle === 'yearly' ? 'bg-[rgba(255,255,255,0.08)] text-foreground' : 'text-[rgba(255,255,255,0.4)]'}`}
                                        >
                                            Yıllık
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-bold">₺{billingCycle === 'monthly' ? PRICING.proMonthly : PRICING.proYearly.toLocaleString('tr-TR')}</span>
                                        <span className="text-muted-foreground">/ {billingCycle === 'monthly' ? 'ay' : 'yıl'}</span>
                                    </div>
                                    {billingCycle === 'yearly' && (
                                        <p className="text-[10px] text-emerald-600 font-medium">~2 ay ücretsiz! (Yıllık %17 tasarruf)</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {isPro && (
                            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4 flex flex-col justify-center items-center text-center space-y-2">
                                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-1">
                                    <CreditCard className="h-5 w-5 text-emerald-600" />
                                </div>
                                <p className="text-xs font-medium">Ödeme Yöntemi</p>
                                <p className="text-[10px] text-muted-foreground">Kart bilgileriniz Stripe üzerinden güvenle saklanmaktadır.</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* ─── 3. Email Settings & Notifications ─── */}
                <section className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-6 space-y-5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-2xl opacity-50"></div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                            <Mail className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="font-semibold">E-posta Bildirimleri</h2>
                            <p className="text-xs text-muted-foreground">Hangi e-postaları almak istediğinizi yönetin.</p>
                        </div>
                    </div>

                    {/* BÖLÜM 1 — Hesap Bildirimleri (zorunlu) */}
                    <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pb-1">Hesap Bildirimleri</p>
                        {[
                            { label: 'Hoş geldin e-postası', desc: 'Kayıt olduğunuzda gönderilir.' },
                            { label: 'E-posta doğrulama', desc: 'Hesap doğrulama linki.' },
                            { label: 'Şifre sıfırlama', desc: 'Şifre sıfırlama linki.' },
                            { label: 'Pro plan aktivasyonu', desc: 'Pro plan aktif olduğunda bildirim.' },
                            { label: 'Pro plan sona erme', desc: 'Pro planınız sona erdiğinde bildirim.' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between rounded-xl p-4 hover:bg-white/5 transition-colors">
                                <div className="flex-1">
                                    <p className="text-sm font-medium flex items-center gap-2">
                                        {item.label}
                                        <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">Zorunlu</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                                </div>
                                <Switch checked={true} disabled className="opacity-50" />
                            </div>
                        ))}
                    </div>

                    <div className="divider border-t border-border" />

                    {/* BÖLÜM 2 — Tercihli Bildirimler */}
                    <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pb-1">Tercihli Bildirimler</p>

                        {/* Haftalık Özet Raporu */}
                        <div className="flex items-center justify-between rounded-xl p-4 hover:bg-white/5 transition-colors">
                            <div className="flex-1">
                                <p className="text-sm font-medium">Haftalık Özet Raporu</p>
                                <p className="text-xs text-muted-foreground">Her hafta performans özeti e-posta ile gönderilir.</p>
                            </div>
                            <Switch
                                checked={weeklyReport}
                                onCheckedChange={async (v) => {
                                    setWeeklyReport(v);
                                    await save({ email_weekly_report: v }, `Haftalık özet ${v ? 'açıldı' : 'kapatıldı'}.`);
                                }}
                            />
                        </div>

                        {/* Zarar Eden Ürün Tespiti */}
                        <div className="flex items-center justify-between rounded-xl p-4 hover:bg-white/5 transition-colors">
                            <div className="flex-1">
                                <p className="text-sm font-medium">Zarar Eden Ürün Tespiti</p>
                                <p className="text-xs text-muted-foreground">Zarar eden ürün tespit edildiğinde uyarı gönderir.</p>
                            </div>
                            <Switch
                                checked={riskAlert}
                                onCheckedChange={async (v) => {
                                    setRiskAlert(v);
                                    await save({ email_risk_alert: v }, `Zarar uyarısı ${v ? 'açıldı' : 'kapatıldı'}.`);
                                }}
                            />
                        </div>

                        {/* Hedef Marj Uyarısı */}
                        <div className="flex items-center justify-between rounded-xl p-4 hover:bg-white/5 transition-colors">
                            <div className="flex-1">
                                <p className="text-sm font-medium">Hedef Marj Uyarısı</p>
                                <p className="text-xs text-muted-foreground">Marj, belirlediğiniz hedefin altına düşerse uyarır.</p>
                            </div>
                            <Switch
                                checked={marginAlert}
                                onCheckedChange={async (v) => {
                                    setMarginAlert(v);
                                    await save({ email_margin_alert: v }, `Marj uyarısı ${v ? 'açıldı' : 'kapatıldı'}.`);
                                }}
                            />
                        </div>

                        {/* Pro Bitiş Hatırlatıcısı */}
                        <div className="flex items-center justify-between rounded-xl p-4 hover:bg-white/5 transition-colors">
                            <div className="flex-1">
                                <p className="text-sm font-medium">Pro Bitiş Hatırlatıcısı</p>
                                <p className="text-xs text-muted-foreground">Pro planınız bitmeden 7 ve 1 gün önce hatırlatma gönderir.</p>
                            </div>
                            <Switch
                                checked={proExpiry}
                                onCheckedChange={async (v) => {
                                    setProExpiry(v);
                                    await save({ email_pro_expiry: v }, `Pro bitiş hatırlatıcısı ${v ? 'açıldı' : 'kapatıldı'}.`);
                                }}
                            />
                        </div>
                    </div>

                    <div className="divider border-t border-border" />

                    {/* Sistem Testi */}
                    <div className="rounded-xl border border-border p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                        <div>
                            <p className="text-sm font-medium flex items-center gap-1.5">Sistem Testi <CheckCircle2 className="h-4 w-4 text-emerald-500" /></p>
                            <p className="text-xs text-muted-foreground">Test e-postası gönder (Brevo SMTP)</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={async () => {
                                toast.loading('Brevo SMTP üzerinden test maili gönderiliyor...', { id: 'test-email' });
                                try {
                                    const res = await fetch('/api/email/test', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ template: 'test_email' })
                                    });
                                    const data = await res.json();

                                    if (res.ok) {
                                        toast.success(`Başarılı! (ID: ${data.provider_message_id})`, { id: 'test-email' });
                                    } else {
                                        toast.error(`Hata: ${data.error}`, { id: 'test-email' });
                                    }
                                } catch (e) {
                                    toast.error('Bağlantı hatası.', { id: 'test-email' });
                                }
                            }}
                        >
                            <Mail className="h-4 w-4 mr-2" />
                            Test Gönder
                        </Button>
                    </div>
                </section>

                {/* ─── 3. Analysis Defaults ─── */}
                <section className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-6 space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                            <Store className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="font-semibold">Analiz Varsayılanları</h2>
                            <p className="text-xs text-muted-foreground">&quot;Yeni Analiz&quot; formunda otomatik doldurulacak değerler.</p>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                            <Label className="text-sm font-medium">Varsayılan Pazaryeri</Label>
                            <select
                                value={defaultMp}
                                onChange={(e) => setDefaultMp(e.target.value as Marketplace)}
                                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                {MARKETPLACE_OPTIONS.map((mp) => (
                                    <option key={mp.key} value={mp.key}>{mp.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Komisyon Oranı</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={defaultCommission}
                                    onChange={(e) => setDefaultCommission(parseFloat(e.target.value) || 0)}
                                    min={0} max={100} className="h-10 pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">KDV Oranı</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={defaultVat}
                                    onChange={(e) => setDefaultVat(parseFloat(e.target.value) || 0)}
                                    min={0} max={100} className="h-10 pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">İade Oranı</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={defaultReturn}
                                    onChange={(e) => setDefaultReturn(parseFloat(e.target.value) || 0)}
                                    min={0} max={100} className="h-10 pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Reklam Maliyeti</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={defaultAds}
                                    onChange={(e) => setDefaultAds(parseFloat(e.target.value) || 0)}
                                    min={0} className="h-10 pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₺</span>
                            </div>
                        </div>
                    </div>

                    <Button
                        size="sm"
                        disabled={saving}
                        className="rounded-[10px]"
                        onClick={() => save({
                            default_marketplace: defaultMp,
                            default_commission: defaultCommission,
                            default_vat: defaultVat,
                            default_return_rate: defaultReturn,
                            default_ads_cost: defaultAds,
                        }, 'Varsayılanlar kaydedildi.')}
                    >
                        {saving ? 'Kaydediliyor...' : 'Varsayılanları Kaydet'}
                    </Button>
                </section>

                {/* ─── 4. Security ─── */}
                <section className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-6 space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                            <Shield className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="font-semibold">Hesap Güvenliği</h2>
                            <p className="text-xs text-muted-foreground">Giriş yöntemlerinizi ve oturum güvenliğinizi yönetin.</p>
                        </div>
                    </div>

                    {/* Profile info */}
                    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-[11px] text-muted-foreground">E-posta Adresi</p>
                                <p className="text-sm font-medium">{user.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Key className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-[11px] text-muted-foreground">Bağlı Sağlayıcılar</p>
                                <div className="flex gap-1.5 mt-0.5">
                                    {(providers.length > 0 ? providers : ['email']).map((p) => (
                                        <span key={p} className="inline-flex items-center gap-1 rounded-full border bg-[rgba(255,255,255,0.06)] px-2 py-0.5 text-[10px] font-medium capitalize">
                                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                            {p === 'email' ? 'E-posta' : p}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Password change */}
                    {(providers.includes('email') || providers.length === 0) && (
                        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4 space-y-3">
                            <p className="text-sm font-medium">Şifre Değiştir</p>
                            <div className="flex gap-2">
                                <Input
                                    type="password"
                                    placeholder="Yeni şifre (min 6 karakter)"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="h-10 flex-1"
                                />
                                <Button
                                    size="sm"
                                    disabled={passwordLoading || newPassword.length < 6}
                                    onClick={handlePasswordChange}
                                    className="rounded-[10px] h-10"
                                >
                                    {passwordLoading ? 'Değiştiriliyor...' : 'Değiştir'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Session actions */}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-red-400 border-red-500/20 hover:bg-red-500/10 rounded-[10px]"
                            onClick={logout}
                        >
                            <LogOut className="h-4 w-4" />
                            Oturumu Kapat
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-red-400 border-red-500/20 hover:bg-red-500/10 rounded-[10px]"
                            onClick={async () => {
                                await createClient().auth.signOut({ scope: 'global' });
                                router.push('/auth');
                            }}
                        >
                            <LogOut className="h-4 w-4" />
                            Tüm Cihazlardan Çıkış
                        </Button>
                    </div>
                </section>

                {/* ─── 5. Data Management ─── */}
                <section className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-6 space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                            <Database className="h-5 w-5 text-orange-400" />
                        </div>
                        <div>
                            <h2 className="font-semibold">Veri Yönetimi</h2>
                            <p className="text-xs text-muted-foreground">
                                {analyses.length} analiz kaydınız var.
                            </p>
                        </div>
                    </div>

                    {/* Export */}
                    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4 space-y-3">
                        <p className="text-sm font-medium">Verileri Dışa Aktar</p>
                        <p className="text-xs text-muted-foreground">Tüm analizlerinizi CSV veya JSON formatında indirin.</p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="gap-1.5 rounded-[10px]" onClick={handleExportCSV}>
                                <Download className="h-4 w-4" />
                                CSV İndir
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1.5 rounded-[10px]" onClick={handleExportJSON}>
                                <Download className="h-4 w-4" />
                                JSON İndir
                            </Button>
                        </div>
                    </div>

                    {/* Delete all */}
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-400" />
                            <p className="text-sm font-medium text-red-400">Tehlikeli Bölge</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Tüm analiz geçmişinizi ve kaydedilen ürün verilerinizi kalıcı olarak silebilirsiniz. Bu işlem geri alınamaz.
                        </p>
                        <Dialog open={deleteDialogOpen} onOpenChange={(v) => {
                            setDeleteDialogOpen(v);
                            if (!v) setDeleteConfirmText('');
                        }}>
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 text-red-400 border-red-500/20 hover:bg-red-500/10 rounded-[10px]"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Tüm Verileri Sil
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-red-500" />
                                        Tüm Verileri Sil
                                    </DialogTitle>
                                    <DialogDescription>
                                        Bu işlem tüm analizlerinizi kalıcı olarak silecek. Onaylamak için aşağıya <strong>KARNET</strong> yazın.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-2 py-2">
                                    <Input
                                        placeholder='Onaylamak için "KARNET" yazın'
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        className="font-mono"
                                    />
                                </div>
                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmText(''); }}
                                        disabled={deleting}
                                    >
                                        İptal
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={handleDeleteAll}
                                        disabled={deleting || deleteConfirmText !== 'KARNET'}
                                    >
                                        {deleting ? 'Siliniyor...' : 'Evet, Tümünü Sil'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </section>

            </div>
        </DashboardLayout>
    );
}
