'use client';

import { useAuth } from '@/contexts/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Crown, Mail, Shield } from 'lucide-react';
import Link from 'next/link';
import { PLAN_LIMITS } from '@/config/plans';
import { isProUser } from '@/utils/access';

export default function AccountPage() {
  const { user, upgradePlan } = useAuth();

  if (!user) return null;

  const isPro = isProUser(user);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hesap</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hesap bilgilerinizi ve plan detaylarinizi gorun.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Profil</h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">E-posta</p>
                <p className="text-sm font-medium">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kullanici ID</p>
                <p className="text-sm font-medium font-mono">{user.id}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Plan</h2>
          <div className="mt-4">
            <div className="flex items-center gap-2">
              {isPro && <Crown className="h-5 w-5 text-amber-500" />}
              <span className="text-lg font-bold">
                {isPro ? 'Pro Plan' : 'Ucretsiz Plan'}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPro
                ? 'Tum ozelliklere erisiniz var. Sinirsiz analiz yapabilirsiniz.'
                : `Maksimum ${PLAN_LIMITS.free.maxProducts} urun analizi. Gelismis ozellikler icin Pro'ya yukseltin.`}
            </p>

            {!isPro && (
              <div className="mt-4 flex gap-2">
                <Button onClick={() => upgradePlan()}>Pro&apos;ya Yukselt</Button>
                <Link href="/pricing">
                  <Button variant="outline">Planlari Gor</Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {isPro && (
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Pro Ozellikleri
            </h2>
            <ul className="mt-4 space-y-2">
              {[
                'Sinirsiz urun analizi',
                'Hassasiyet analizi',
                'Pazaryeri karsilastirmasi',
                'Nakit akisi tahmini',
                'CSV iceri/disari aktarma',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
