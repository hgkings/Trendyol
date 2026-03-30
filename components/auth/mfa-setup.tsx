'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ShieldCheck, Loader2, Copy, Check } from 'lucide-react';

interface MFASetupProps {
  onComplete: () => void;
}

export function MFASetup({ onComplete }: MFASetupProps) {
  const [step, setStep] = useState<'idle' | 'enrolling' | 'verifying'>('idle');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [factorId, setFactorId] = useState<string>('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const startEnrollment = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Kârnet Authenticator',
      });

      if (error) {
        toast.error('MFA kaydı başlatılamadı: ' + error.message);
        return;
      }

      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
        setStep('verifying');
      }
    } catch {
      toast.error('Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async () => {
    if (code.length !== 6) {
      toast.error('6 haneli doğrulama kodunu girin.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        toast.error('Doğrulama başlatılamadı: ' + challengeError.message);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) {
        toast.error('Kod geçersiz. Lütfen tekrar deneyin.');
        return;
      }

      toast.success('İki faktörlü doğrulama başarıyla etkinleştirildi!');
      onComplete();
    } catch {
      toast.error('Doğrulama sırasında hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === 'idle') {
    return (
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold">İki Faktörlü Doğrulama (2FA)</h3>
            <p className="text-xs text-muted-foreground">Hesabınızı ek güvenlik katmanıyla koruyun</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Google Authenticator, Authy veya benzeri bir uygulama ile 2FA etkinleştirin.
          Her girişte 6 haneli bir kod girmeniz gerekecek.
        </p>
        <Button onClick={startEnrollment} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          2FA Etkinleştir
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-5">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-400" />
        <h3 className="font-semibold text-emerald-300">2FA Kurulumu</h3>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          1. Authenticator uygulamanızla QR kodu tarayın:
        </p>

        {qrCode && (
          <div className="flex justify-center p-4 bg-white rounded-lg w-fit mx-auto">
            <img src={qrCode} alt="QR Code" width={200} height={200} />
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            QR kodu tarayamıyorsanız bu kodu manuel girin:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-black/30 rounded-lg px-3 py-2 font-mono text-emerald-300 break-all">
              {secret}
            </code>
            <Button variant="ghost" size="sm" onClick={copySecret} className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            2. Uygulamadaki 6 haneli kodu girin:
          </p>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="font-mono text-center text-lg tracking-widest max-w-[180px]"
              maxLength={6}
            />
            <Button onClick={verifySetup} disabled={loading || code.length !== 6} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Doğrula
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
