'use client';

import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Search, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { PlanType } from '@/types';

interface UserRow {
    id: string;
    email: string;
    plan: PlanType;
    pro_until: string | null;
    pro_expires_at: string | null;
    created_at: string;
}

const PLAN_COLORS: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    pro: 'bg-amber-100 text-amber-700',
    pro_monthly: 'bg-amber-100 text-amber-700',
    pro_yearly: 'bg-amber-100 text-amber-700',
    starter: 'bg-blue-100 text-blue-700',
    starter_monthly: 'bg-blue-100 text-blue-700',
    starter_yearly: 'bg-blue-100 text-blue-700',
    free: 'bg-gray-100 text-gray-600',
};

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [editUser, setEditUser] = useState<UserRow | null>(null);
    const [newPlan, setNewPlan] = useState<PlanType>('free');
    const [saving, setSaving] = useState(false);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page) });
        if (search) params.set('search', search);
        if (planFilter) params.set('plan', planFilter);
        const res = await fetch(`/api/admin/users?${params}`);
        const data = await res.json();
        setUsers(data.users ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
    }, [page, search, planFilter]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleEdit = (user: UserRow) => {
        setEditUser(user);
        setNewPlan(user.plan);
    };

    const handleSave = async () => {
        if (!editUser) return;
        setSaving(true);
        const res = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: editUser.id, plan: newPlan }),
        });
        setSaving(false);
        if (res.ok) {
            toast.success('Plan güncellendi');
            setEditUser(null);
            fetchUsers();
        } else {
            toast.error('Güncelleme başarısız');
        }
    };

    const totalPages = Math.ceil(total / 20);

    return (
        <AdminLayout>
            <div className="space-y-5">
                <div>
                    <h1 className="text-2xl font-bold">Kullanıcı Yönetimi</h1>
                    <p className="text-sm text-muted-foreground mt-1">{total} kullanıcı</p>
                </div>

                {/* Filters */}
                <div className="flex gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="E-posta ara..."
                            className="pl-9"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                    <Select value={planFilter || 'all'} onValueChange={v => { setPlanFilter(v === 'all' ? '' : v); setPage(1); }}>
                        <SelectTrigger className="w-36">
                            <SelectValue placeholder="Plan" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tümü</SelectItem>
                            <SelectItem value="free">Ücretsiz</SelectItem>
                            <SelectItem value="starter">Starter</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
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
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">E-posta</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pro Bitiş</th>
                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kayıt Tarihi</th>
                                            <th className="px-4 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {users.map(u => (
                                            <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3 font-medium">{u.email}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLAN_COLORS[u.plan] ?? PLAN_COLORS.free}`}>
                                                        {u.plan}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {u.pro_until ? new Date(u.pro_until).toLocaleDateString('tr-TR') : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {new Date(u.created_at).toLocaleDateString('tr-TR')}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button size="sm" variant="ghost" onClick={() => handleEdit(u)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
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

            {/* Edit Dialog */}
            <Dialog open={!!editUser} onOpenChange={open => !open && setEditUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Plan Değiştir</DialogTitle>
                    </DialogHeader>
                    {editUser && (
                        <div className="space-y-4 py-2">
                            <p className="text-sm text-muted-foreground">{editUser.email}</p>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Yeni Plan</label>
                                <Select value={newPlan} onValueChange={v => setNewPlan(v as PlanType)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="free">Ücretsiz</SelectItem>
                                        <SelectItem value="starter">Starter</SelectItem>
                                        <SelectItem value="starter_monthly">Starter (Aylık)</SelectItem>
                                        <SelectItem value="starter_yearly">Starter (Yıllık)</SelectItem>
                                        <SelectItem value="pro">Pro</SelectItem>
                                        <SelectItem value="pro_monthly">Pro (Aylık)</SelectItem>
                                        <SelectItem value="pro_yearly">Pro (Yıllık)</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditUser(null)}>İptal</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Kaydet
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
