'use client';

import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface Payment {
    id: string;
    user_id: string;
    plan: string;
    amount_try: number;
    status: string;
    provider: string;
    provider_order_id: string | null;
    paid_at: string | null;
    created_at: string;
    profiles: { email: string } | null;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    paid: { label: 'Ödendi', color: 'text-green-600 bg-green-50', icon: CheckCircle2 },
    created: { label: 'Bekliyor', color: 'text-amber-600 bg-amber-50', icon: Clock },
    failed: { label: 'Başarısız', color: 'text-red-600 bg-red-50', icon: XCircle },
};

export default function AdminPaymentsPage() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');

    const fetchPayments = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page) });
        if (statusFilter) params.set('status', statusFilter);
        const res = await fetch(`/api/admin/payments?${params}`);
        const data = await res.json();
        setPayments(data.payments ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
    }, [page, statusFilter]);

    useEffect(() => { fetchPayments(); }, [fetchPayments]);

    const totalPages = Math.ceil(total / 20);

    const paidTotal = payments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + (p.amount_try || 0), 0);

    return (
        <AdminLayout>
            <div className="space-y-5">
                <div>
                    <h1 className="text-2xl font-bold">Ödeme Geçmişi</h1>
                    <p className="text-sm text-muted-foreground mt-1">{total} kayıt</p>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Toplam İşlem', value: total },
                        { label: 'Bu Sayfada Ödenen', value: `₺${paidTotal.toLocaleString('tr-TR')}` },
                        { label: 'Başarılı', value: payments.filter(p => p.status === 'paid').length },
                    ].map(item => (
                        <Card key={item.label}>
                            <CardContent className="pt-4 pb-3 px-4">
                                <p className="text-xs text-muted-foreground">{item.label}</p>
                                <p className="text-xl font-bold mt-0.5">{item.value}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Filter */}
                <div className="flex gap-3">
                    <Select value={statusFilter || 'all'} onValueChange={v => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="Durum" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tümü</SelectItem>
                            <SelectItem value="paid">Ödendi</SelectItem>
                            <SelectItem value="created">Bekliyor</SelectItem>
                            <SelectItem value="failed">Başarısız</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Table */}
                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin h-6 w-6" /></div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kullanıcı</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tutar</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Durum</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tarih</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {payments.map(p => {
                                            const s = STATUS_MAP[p.status] ?? STATUS_MAP.created;
                                            return (
                                                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                                                    <td className="px-4 py-3 font-medium">
                                                        {(p.profiles as any)?.email ?? p.user_id.slice(0, 8) + '...'}
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground capitalize">{p.plan}</td>
                                                    <td className="px-4 py-3 font-semibold">₺{(p.amount_try || 0).toLocaleString('tr-TR')}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.color}`}>
                                                            <s.icon className="h-3 w-3" />
                                                            {s.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground">
                                                        {new Date(p.paid_at ?? p.created_at).toLocaleDateString('tr-TR')}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Sayfa {page} / {totalPages}</p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
