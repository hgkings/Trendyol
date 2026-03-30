'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ShieldCheck, ShieldOff, Loader2, Copy, Check } from 'lucide-react';

interface MFASetupProps {
  onComplete: () => void;
}

export function MFASetup({ onComplete }: MFASetupProps) {
  const [step, setStep] = useState<'loading' | 'idle' | 'active' | 'enrolling' | 'verifying'>('loading');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [factorId, setFactorId] = useState<string>('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [disabling, setDisabling] = useState(false);

  // Mevcut MFA durumunu kontrol et
  useEffect(() => {
    const checkMFAStatus = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.mfa.listFactors();

        const verifiedFactors = data?.totp?.filter((f: { status: string }) => f.status === 'verified') ?? [];

        if (verifiedFactors.length > 0) {
          setFactorId(verifiedFactors[0].id);
          setStep('active');
        } else {
          setStep('idle');
        }
      } catch {
        setStep('idle');
      }
    };
    checkMFAStatus();
  }, []);

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
        if (verifyError.message?.includes('expired') || verifyError.message?.includes('timeout')) {
          toast.error('Doğrulama süresi doldu. Lütfen tekrar deneyin.');
        } else {
          toast.error('Kod geçersiz veya süresi dolmuş. Telefonunuzun saatini kontrol edin.');
        }
        return;
      }

      setStep('active');
      setCode('');
      setQrCode('');
      setSecret('');
      onComplete();
    } catch {
      toast.error('Doğrulama sırasında hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const disableMFA = async () => {
    setDisabling(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId });

      if (error) {
        toast.error('2FA devre dışı bırakılamadı: ' + error.message);
        return;
      }

      setStep('idle');
      setFactorId('');
      toast.success('İki faktörlü doğrulama devre dışı bırakıldı.');
    } catch {
      toast.error('Beklenmeyen bir hata oluştu.');
    } finally {
      setDisabling(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Yükleniyor
  if (step === 'loading') {
    return (
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">2FA durumu kontrol ediliyor...</span>
        </div>
      </div>
    );
  }

  // 2FA aktif
  if (step === 'active') {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-emerald-300">İki Faktörlü Doğrulama Aktif</h3>
            <p className="text-xs text-muted-foreground">Hesabınız ek güvenlik katmanıyla korunuyor</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={disableMFA}
          disabled={disabling}
          className="gap-2 text-red-400 border-red-500/20 hover:bg-red-500/10"
        >
          {disabling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
          2FA Devre Dışı Bırak
        </Button>
      </div>
    );
  }

  // 2FA kurulumu — QR ve kod girişi
  if (step === 'verifying') {
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

  // 2FA devre dışı — etkinleştir butonu
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
