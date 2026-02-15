'use client';

import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Crown, X, Check } from 'lucide-react';
import { PRICING, formatPrice, monthlyLabel } from '@/config/pricing';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

const features = [
  'Sinirsiz urun analizi',
  'Hassasiyet analizi',
  'Pazaryeri karsilastirmasi',
  'Nakit akisi tahmini',
  'CSV iceri aktarma',
  'CSV & rapor disari aktarma',
];

export function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const { upgradePlan } = useAuth();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-card p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            <h2 className="text-xl font-bold">Pro&apos;ya Yukselt</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          Ucretsiz plan limitine ulastiniz. Pro plana gecis yaparak tum ozelliklere erisebilirsiniz.
        </p>

        <div className="mt-6 space-y-3">
          {features.map((f) => (
            <div key={f} className="flex items-center gap-2.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-sm">{f}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          <Button
            className="w-full"
            onClick={async () => {
              await upgradePlan();
              onClose();
            }}
          >
            {monthlyLabel()} - Pro&apos;ya Geç
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>
            Simdilik Degil
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Demo: Tiklayin ve aninda Pro olun
        </p>
      </div>
    </div>
  );
}
