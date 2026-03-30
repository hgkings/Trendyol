'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Crown, BarChart2, TrendingUp, MessageSquare, AlertCircle } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface Stats {
    totalUsers: number;
    proUsers: number;
    starterUsers: number;
    freeUsers: number;
    totalAnalyses: number;
    totalRevenue: number;
    totalTickets: number;
    openTickets: number;
    recentUsers: { id: string; email: string; plan: string; created_at: string }[];
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/admin/stats')
            .then(r => r.json())
            .then(data => { setStats(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const kpis = stats ? [
        {
            title: 'Toplam Kullanıcı',
            value: stats.totalUsers,
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-500/10',
        },
        {
            title: 'Pro Kullanıcı',
            value: stats.proUsers,
            sub: `${stats.starterUsers} starter · ${stats.freeUsers} ücretsiz`,
            icon: Crown,
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
        },
        {
            title: 'Toplam Analiz',
            value: stats.totalAnalyses,
            icon: BarChart2,
            color: 'text-green-600',
            bg: 'bg-emerald-500/10',
        },
        {
            title: 'Toplam Gelir',
            value: `₺${stats.totalRevenue.toLocaleString('tr-TR')}`,
            icon: TrendingUp,
            color: 'text-purple-600',
            bg: 'bg-purple-500/10',
        },
        {
            title: 'Destek Talepleri',
            value: stats.totalTickets,
            sub: `${stats.openTickets} açık`,
            icon: MessageSquare,
            color: 'text-rose-600',
            bg: 'bg-rose-500/10',
        },
    ] : [];

    const planBadge = (plan: string) => {
        const map: Record<string, string> = {
            admin: 'bg-red-100 text-red-700',
            pro: 'bg-amber-100 text-amber-700',
            pro_monthly: 'bg-amber-100 text-amber-700',
            pro_yearly: 'bg-amber-100 text-amber-700',
            starter: 'bg-blue-100 text-blue-700',
            starter_monthly: 'bg-blue-100 text-blue-700',
            starter_yearly: 'bg-blue-100 text-blue-700',
            free: 'bg-gray-100 text-gray-600',
        };
        return map[plan] ?? map.free;
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">Genel platform istatistikleri</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6" /></div>
                ) : !stats ? (
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span>Veriler yüklenemedi.</span>
                    </div>
                ) : (
                    <>
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                            {kpis.map((kpi) => (
                                <Card key={kpi.title}>
                                    <CardContent className="pt-5 pb-4 px-5">
                                        <div className={`inline-flex p-2 rounded-lg ${kpi.bg} mb-3`}>
                                            <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                                        </div>
                                        <p className="text-xs text-muted-foreground font-medium">{kpi.title}</p>
                                        <p className="text-2xl font-bold mt-0.5">{kpi.value}</p>
                                        {kpi.sub && <p className="text-xs text-muted-foreground">{kpi.sub}</p>}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Recent Users */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Son Kayıt Olan Kullanıcılar</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="divide-y">
                                    {stats.recentUsers.map((u) => (
                                        <div key={u.id} className="flex items-center justify-between py-2.5">
                                            <div>
                                                <p className="text-sm font-medium">{u.email}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(u.created_at).toLocaleDateString('tr-TR')}
                                                </p>
                                            </div>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${planBadge(u.plan)}`}>
                                                {u.plan}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </AdminLayout>
    );
}
