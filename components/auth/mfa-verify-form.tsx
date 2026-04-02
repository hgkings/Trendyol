'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ShieldCheck, Loader2 } from 'lucide-react';

interface MFAVerifyFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function MFAVerifyForm({ onSuccess, onCancel }: MFAVerifyFormProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error('6 haneli doğrulama kodunu girin.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      // Kullanicinin kayitli TOTP factor'unu bul
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError || !factorsData?.totp || factorsData.totp.length === 0) {
        toast.error('MFA faktörü bulunamadı.');
        return;
      }

      const factor = factorsData.totp[0];

      // Challenge olustur
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });

      if (challengeError) {
        toast.error('Doğrulama başlatılamadı.');
        return;
      }

      // Kodu dogrula
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) {
        toast.error('Kod geçersiz. Lütfen tekrar deneyin.');
        setCode('');
        return;
      }

      onSuccess();
    } catch {
      toast.error('Doğrulama sırasında hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
          <ShieldCheck className="h-8 w-8 text-emerald-700 dark:text-emerald-400" />
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold">İki Faktörlü Doğrulama</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Authenticator uygulamanızdaki 6 haneli kodu girin.
        </p>
      </div>

      <div className="flex justify-center">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className="font-mono text-center text-2xl tracking-[0.5em] max-w-[220px] h-14"
          maxLength={6}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && code.length === 6) handleVerify();
          }}
        />
      </div>

      <div className="flex gap-3 justify-center">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          İptal
        </Button>
        <Button onClick={handleVerify} disabled={loading || code.length !== 6} className="gap-2 min-w-[120px]">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Doğrula
        </Button>
      </div>
    </div>
  );
}
