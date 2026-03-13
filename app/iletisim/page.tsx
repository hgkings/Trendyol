import type { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';
import { Mail, Phone, MapPin } from 'lucide-react';

export const metadata: Metadata = {
  title: 'İletişim | Kârnet',
  description: 'Kârnet ile iletişime geçin. Sorularınız, önerileriniz ve destek talepleriniz için bize ulaşın.',
};

export default function IletisimPage() {
  return (
    <LegalPageLayout title="İletişim" description="Kârnet ile ilgili destek, soru veya önerileriniz için aşağıdaki kanallardan bize ulaşabilirsiniz.">
      
      <div className="mt-8 space-y-6">
        <div className="flex items-start gap-4 rounded-xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <h3 className="m-0 text-lg font-semibold text-foreground">E-posta</h3>
            <p className="mt-1 text-base text-muted-foreground">
              <a href="mailto:karnet.destek@gmail.com" className="hover:text-primary transition-colors no-underline">
                karnet.destek@gmail.com
              </a>
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Phone className="h-6 w-6" />
          </div>
          <div>
            <h3 className="m-0 text-lg font-semibold text-foreground">Telefon</h3>
            <p className="mt-1 text-base text-muted-foreground">
              +90 543 382 45 21
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <h3 className="m-0 text-lg font-semibold text-foreground">Adres</h3>
            <p className="mt-1 text-base leading-relaxed text-muted-foreground">
              Konya Seydişehir<br />
              Ulukapı Mahallesi<br />
              153103 Sokak No:52<br />
              Türkiye
            </p>
          </div>
        </div>
      </div>
    </LegalPageLayout>
  );
}
