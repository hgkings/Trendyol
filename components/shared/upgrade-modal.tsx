'use client';

import { Button } from '@/components/ui/button';
import { Crown, X, Check, Loader2, Zap } from 'lucide-react';
import { PRICING } from '@/config/pricing';
import { toast } from 'sonner';
import { useState } from 'react';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

const starterFeatures = [
  '25 ürün analizi',
  'CSV içe/dışa aktarma',
  'Duyarlılık analizi',
  'Başabaş hesaplama',
  'Aylık 5 PDF rapor',
];

const proFeatures = [
  'Sınırsız ürün analizi',
  'Pazaryeri entegrasyonları',
  'Nakit akışı tahmini',
  'Pazaryeri karşılaştırması',
  'Sınırsız PDF rapor',
  'Premium destek',
];

export function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const [loading, setLoading] = useState<string | null>(null);

  if (!open) return null;

  const handleUpgrade = async (plan: string) => {
    setLoading(plan);
    try {
      const res = await fetch('/api/paytr/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.paymentUrl) {
        window.open(data.paymentUrl, '_blank');
        const params = new URLSearchParams({ paymentId: data.paymentId });
        if (data.token) params.set('token', data.token);
        window.location.href = `/basari?${params.toString()}`;
      } else {
        toast.error(data.error || 'Ödeme başlatılamadı.');
        setLoading(null);
      }
    } catch {
      toast.error('Ödeme başlatılamadı.');
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-border/40 bg-card p-8 shadow-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Planınızı Yükseltin</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Ücretsiz plan limitine ulaştınız. Daha fazla özellik için planınızı seçin.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {/* Starter */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-400" />
              <span className="font-bold text-blue-300">Başlangıç</span>
            </div>
            <div className="space-y-2">
              {starterFeatures.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-blue-400 shrink-0" />
                  <span className="text-xs">{f}</span>
                </div>
              ))}
            </div>
            <Button
              className="w-full rounded-xl text-white text-xs"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}
              disabled={loading !== null}
              onClick={() => handleUpgrade('starter_monthly')}
            >
              {loading === 'starter_monthly' ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Yönlendiriliyor</>
              ) : (
                <>{PRICING.symbol}{PRICING.starter.monthly}/ay</>
              )}
            </Button>
          </div>

          {/* Pro */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-700 dark:text-amber-400" />
              <span className="font-bold text-amber-700 dark:text-amber-300">Profesyonel</span>
            </div>
            <div className="space-y-2">
              {proFeatures.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-amber-700 dark:text-amber-400 shrink-0" />
                  <span className="text-xs">{f}</span>
                </div>
              ))}
            </div>
            <Button
              className="w-full rounded-xl text-white text-xs"
              style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}
              disabled={loading !== null}
              onClick={() => handleUpgrade('pro_monthly')}
            >
              {loading === 'pro_monthly' ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Yönlendiriliyor</>
              ) : (
                <>{PRICING.symbol}{PRICING.pro.monthly}/ay</>
              )}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={onClose}>
            Şimdilik Değil
          </Button>
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Güvenli ödeme PayTR altyapısı ile gerçekleştirilir.
        </p>
      </div>
    </div>
  );
}
