'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Check } from 'lucide-react';

function getPasswordStrength(pwd: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (pwd.length === 0) return { level: 0, label: '' };
  if (pwd.length < 8) return { level: 1, label: 'Zayıf' };
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  if (pwd.length >= 12 && hasUpper && hasLower && hasNumber) return { level: 3, label: 'Güçlü' };
  return { level: 2, label: 'Orta' };
}

const strengthColors: Record<1 | 2 | 3, string> = {
  1: 'bg-red-500',
  2: 'bg-amber-500',
  3: 'bg-emerald-500',
};
const strengthTextColors: Record<1 | 2 | 3, string> = {
  1: 'text-red-400',
  2: 'text-amber-700 dark:text-amber-400',
  3: 'text-emerald-700 dark:text-emerald-400',
};

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const pwdStrength = getPasswordStrength(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      const msg = updateError.message.toLowerCase();
      if (msg.includes('same password') || msg.includes('different')) {
        setError('Yeni şifreniz eski şifrenizden farklı olmalıdır.');
      } else if (msg.includes('expired') || msg.includes('invalid')) {
        setError('Link geçersiz veya süresi dolmuş. Tekrar deneyiniz.');
      } else {
        setError('Bir hata oluştu. Lütfen tekrar deneyin.');
      }
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    // 5 saniye sonra giriş sayfasına yönlendir
    setTimeout(() => router.push('/auth'), 5000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% 0%, hsl(221 83% 53% / 0.06), transparent 60%), hsl(0 0% 99%)',
      }}
    >
      <div className="w-full max-w-[400px] space-y-6">
        {/* Logo */}
        <div className="text-center">
          <img src="/brand/logo.svg" alt="Kârnet" className="h-8 w-auto mx-auto dark:hidden" />
          <img src="/brand/logo-dark.svg" alt="Kârnet" className="h-8 w-auto mx-auto hidden dark:block" />
        </div>

        <div
          className="rounded-2xl bg-card border border-border/40 p-8 space-y-6"
          style={{
            boxShadow: '0 20px 60px hsl(221 83% 53% / 0.08)',
            border: '1px solid hsl(221 83% 53% / 0.1)',
          }}
        >
          {success ? (
            /* ── Başarı durumu ── */
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Check className="h-7 w-7 text-emerald-700 dark:text-emerald-400" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight font-geist">Şifreniz Güncellendi!</h2>
                <p className="text-sm text-muted-foreground">
                  Yeni şifrenizle giriş yapabilirsiniz. Giriş sayfasına yönlendiriliyorsunuz...
                </p>
              </div>
              <Link href="/auth">
                <Button className="w-full h-11 rounded-xl">
                  Giriş Sayfasına Git
                </Button>
              </Link>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight font-geist">Yeni Şifre Oluştur</h2>
                <p className="text-sm text-muted-foreground">
                  Hesabınız için yeni bir şifre belirleyin.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Yeni Şifre */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Yeni Şifre</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-11 rounded-lg pr-10"
                      autoComplete="new-password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Şifre güç göstergesi */}
                  {pwdStrength.level > 0 && (
                    <div className="space-y-1 pt-0.5">
                      <div className="flex gap-1">
                        {([1, 2, 3] as const).map((n) => (
                          <div
                            key={n}
                            className={`h-1 flex-1 rounded-full transition-all ${
                              n <= pwdStrength.level
                                ? strengthColors[pwdStrength.level as 1 | 2 | 3]
                                : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs font-medium ${strengthTextColors[pwdStrength.level as 1 | 2 | 3]}`}>
                        {pwdStrength.label}
                      </p>
                    </div>
                  )}
                </div>

                {/* Şifre Tekrar */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">Şifre Tekrar</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className={`h-11 rounded-lg pr-10 ${
                        passwordsMismatch ? 'border-red-500/50 focus-visible:ring-red-400' : ''
                      } ${
                        passwordsMatch ? 'border-emerald-500/50 focus-visible:ring-emerald-400' : ''
                      }`}
                      autoComplete="new-password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowConfirm(!showConfirm)}
                      tabIndex={-1}
                    >
                      {passwordsMatch ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : showConfirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {passwordsMismatch && (
                    <p className="text-xs text-red-400">Şifreler eşleşmiyor.</p>
                  )}
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 text-red-400 text-sm border border-red-500/20">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-semibold rounded-xl gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Güncelleniyor...
                    </>
                  ) : (
                    'Şifremi Güncelle'
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
