'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuth } from '@/contexts/auth-context';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Shield, Database, LogOut, Sun, Moon, Bell, SunMoon } from 'lucide-react';
import { toast } from 'sonner';
import { deleteAnalysis, getStoredAnalyses } from '@/lib/storage';
import { Switch } from '@/components/ui/switch';

export default function SettingsPage() {
    const { user, logout, updateProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const handleDeleteAllData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Get all analyses first
            const analyses = await getStoredAnalyses(user.id);

            // Delete one by one (could be optimized with a batch delete if API supports it, 
            // but storage.ts only has deleteAnalysis by ID for now)
            // Since we need to use RLS efficiently, deletion by ID is safe.

            const promises = analyses.map(a => deleteAnalysis(a.id));
            await Promise.all(promises);

            toast.success('Tum analiz verileri basariyla silindi.');
            setDeleteDialogOpen(false);
        } catch (error) {
            toast.error('Veriler silinirken bir hata olustu.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-8 max-w-2xl">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Ayarlar</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Hesap ve uygulama tercihlerinizi yonetin.
                    </p>
                </div>

                {/* Appearance Section */}
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-primary shadow-sm hover:ring-1 hover:ring-primary/20 transition-all">
                            <SunMoon className="h-5 w-5" />
                        </div>
                        <h2 className="text-lg font-semibold">Görünüm</h2>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Tema Secimi</p>
                            <p className="text-sm text-muted-foreground">Aydinlik veya karanlik modu secin.</p>
                        </div>
                        <ThemeToggle />
                    </div>
                </div>

                {/* Notifications Section */}
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                            <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h2 className="text-lg font-semibold">Bildirim Tercihleri</h2>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">E-posta Bildirimleri</p>
                                <p className="text-sm text-muted-foreground">Kritik risk durumlarinda e-posta ile bilgilendirilmek istiyorum.</p>
                                <p className="text-xs text-muted-foreground mt-1">Bildirim e-postası: {user?.email}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                        toast.loading('Test maili gönderiliyor...');
                                        try {
                                            const res = await fetch('/api/notifications/test-email', { method: 'POST' });
                                            if (res.ok) {
                                                toast.success('Test maili gönderildi! Inbox\'ınızı kontrol edin (Spam kutusuna da bakın).');
                                            } else {
                                                const err = await res.json();
                                                toast.error(`Hata: ${err.error || 'Bilinmeyen hata'}`);
                                            }
                                        } catch (e) {
                                            toast.error('Bağlantı hatası.');
                                        } finally {
                                            toast.dismiss();
                                        }
                                    }}
                                >
                                    Test Mail Gönder
                                </Button>
                                <Switch
                                    checked={user?.email_notifications_enabled !== false}
                                    onCheckedChange={async (checked) => {
                                        // Optimistic UI update via AuthContext if possible, but for now we rely on re-fetch
                                        const res = await updateProfile({ email_notifications_enabled: checked });
                                        if (res.success) {
                                            toast.success(`E-posta bildirimleri ${checked ? 'açıldı' : 'kapatıldı'}.`);
                                        } else {
                                            toast.error('Güncelleme sırasında bir hata oluştu.');
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Security Section */}
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="text-lg font-semibold">Hesap Guvenligi</h2>
                    </div>

                    <div className="space-y-6">
                        <div className="grid gap-2">
                            <Label htmlFor="email">E-posta Adresi</Label>
                            <Input id="email" value={user?.email || ''} disabled className="bg-muted" />
                            <p className="text-xs text-muted-foreground">E-posta adresi degistirilemez.</p>
                        </div>

                        <div className="flex justify-end">
                            <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-900" onClick={logout}>
                                <LogOut className="mr-2 h-4 w-4" />
                                Oturumu Kapat
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Data Section */}
                <div className="rounded-xl border bg-card p-6 shadow-sm border-red-100 dark:border-red-900/30">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <Database className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-red-900 dark:text-red-400">Veri Yonetimi</h2>
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Tum analiz gecmisinizi ve kaydedilen urun verilerinizi kalici olarak silebilirsiniz. Bu islem geri alinamaz.
                        </p>

                        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="destructive">
                                    Tum verileri sil
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Emin misiniz?</DialogTitle>
                                    <DialogDescription>
                                        Bu islem tum analizlerinizi kalici olarak silecek. Bu islem geri alinamaz.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={loading}>
                                        Iptal
                                    </Button>
                                    <Button variant="destructive" onClick={handleDeleteAllData} disabled={loading}>
                                        {loading ? 'Siliniyor...' : 'Evet, tum verileri sil'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
