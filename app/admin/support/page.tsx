'use client';

import { useEffect, useState } from 'react';
import { SupportService } from '@/lib/support-service';
import { SupportTicket, SupportStatus } from '@/types';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, RefreshCw, MessageSquare } from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
    open: { label: 'Açık', color: 'bg-blue-100 text-blue-700' },
    in_progress: { label: 'İşleniyor', color: 'bg-amber-100 text-amber-700' },
    resolved: { label: 'Çözüldü', color: 'bg-green-100 text-green-700' },
    closed: { label: 'Kapalı', color: 'bg-gray-100 text-gray-600' },
};

const CATEGORY_COLORS: Record<string, string> = {
    billing: 'bg-purple-100 text-purple-700',
    technical: 'bg-red-100 text-red-700',
    feature: 'bg-cyan-100 text-cyan-700',
    general: 'bg-gray-100 text-gray-600',
};

export default function AdminSupportPage() {
    const [tickets, setTickets] = useState<(SupportTicket & { profiles?: { email: string } })[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<(SupportTicket & { profiles?: { email: string } }) | null>(null);
    const [adminNote, setAdminNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const data = await SupportService.getAllTickets();
            setTickets(data);
        } catch {
            toast.error('Biletler yüklenemedi.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTickets(); }, []);

    const handleStatusUpdate = async (id: string, status: SupportStatus) => {
        try {
            await SupportService.updateStatus(id, status);
            setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
            toast.success('Durum güncellendi');
        } catch {
            toast.error('Durum güncellenemedi');
        }
    };

    const handleNoteUpdate = async () => {
        if (!selectedTicket) return;
        setSaving(true);
        try {
            await SupportService.updateAdminNote(selectedTicket.id, adminNote);
            setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, admin_note: adminNote } : t));
            setSelectedTicket({ ...selectedTicket, admin_note: adminNote });
            toast.success('Not kaydedildi');
        } catch {
            toast.error('Not kaydedilemedi');
        } finally {
            setSaving(false);
        }
    };

    const filtered = statusFilter ? tickets.filter(t => t.status === statusFilter) : tickets;
    const openCount = tickets.filter(t => t.status === 'open').length;

    return (
        <AdminLayout>
            <div className="space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Destek Talepleri</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {tickets.length} toplam · <span className="text-blue-600 font-medium">{openCount} açık</span>
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchTickets}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Yenile
                    </Button>
                </div>

                {/* Filter */}
                <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Durum" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tümü</SelectItem>
                        <SelectItem value="open">Açık</SelectItem>
                        <SelectItem value="in_progress">İşleniyor</SelectItem>
                        <SelectItem value="resolved">Çözüldü</SelectItem>
                        <SelectItem value="closed">Kapalı</SelectItem>
                    </SelectContent>
                </Select>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6" /></div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
                        <MessageSquare className="h-8 w-8 opacity-40" />
                        <p>Gösterilecek destek talebi yok</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(ticket => (
                            <Card key={ticket.id} className="hover:bg-muted/10 transition-colors">
                                <CardContent className="p-4 flex flex-col sm:flex-row gap-4 justify-between">
                                    <div
                                        className="flex-1 space-y-1 cursor-pointer"
                                        onClick={() => { setSelectedTicket(ticket); setAdminNote(ticket.admin_note || ''); }}
                                    >
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-sm">{ticket.subject}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[ticket.category] ?? CATEGORY_COLORS.general}`}>
                                                {ticket.category}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_MAP[ticket.status]?.color}`}>
                                                {STATUS_MAP[ticket.status]?.label}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground line-clamp-1">{ticket.message}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {ticket.profiles?.email} · {new Date(ticket.created_at).toLocaleString('tr-TR')}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <Select
                                            defaultValue={ticket.status}
                                            onValueChange={v => handleStatusUpdate(ticket.id, v as SupportStatus)}
                                        >
                                            <SelectTrigger className="h-8 w-36">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="open">Açık</SelectItem>
                                                <SelectItem value="in_progress">İşleniyor</SelectItem>
                                                <SelectItem value="resolved">Çözüldü</SelectItem>
                                                <SelectItem value="closed">Kapalı</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => { setSelectedTicket(ticket); setAdminNote(ticket.admin_note || ''); }}
                                        >
                                            Detay
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail Dialog */}
            <Dialog open={!!selectedTicket} onOpenChange={open => !open && setSelectedTicket(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedTicket?.subject}</DialogTitle>
                    </DialogHeader>
                    {selectedTicket && (
                        <div className="space-y-4">
                            <div className="flex gap-2 text-xs flex-wrap">
                                <span className="text-muted-foreground">{selectedTicket.profiles?.email}</span>
                                <span>·</span>
                                <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_MAP[selectedTicket.status]?.color}`}>
                                    {STATUS_MAP[selectedTicket.status]?.label}
                                </span>
                            </div>
                            <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">
                                {selectedTicket.message}
                            </div>
                            {selectedTicket.attachment_url && (
                                <p className="text-sm text-blue-600">Ek dosya mevcut</p>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Yönetici Notu / Yanıtı</label>
                                <Textarea
                                    value={adminNote}
                                    onChange={e => setAdminNote(e.target.value)}
                                    rows={4}
                                    placeholder="Kullanıcıya yanıt veya iç not..."
                                />
                                <Button onClick={handleNoteUpdate} disabled={saving} size="sm">
                                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
                                    Kaydet
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
