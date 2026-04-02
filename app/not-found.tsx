import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-6xl font-bold text-amber-500">404</h1>
        <h2 className="text-xl font-semibold">Sayfa Bulunamadı</h2>
        <p className="text-sm text-muted-foreground">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </p>
        <div className="flex items-center justify-center gap-3 pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-[1px] hover:shadow-lg hover:shadow-amber-500/30"
            style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}
          >
            Ana Sayfa
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
