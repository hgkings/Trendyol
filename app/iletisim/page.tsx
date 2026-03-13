import type { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';
import { Mail, Phone, MapPin, User } from 'lucide-react';

export const metadata: Metadata = {
  title: 'İletişim | Kârnet',
  description: 'Kârnet ile iletişime geçin. Sorularınız, önerileriniz ve destek talepleriniz için bize ulaşın.',
};

export default function IletisimPage() {
  return (
    <LegalPageLayout title="İletişim" description="Her türlü soru, öneri ve destek talepleriniz için bizimle iletişime geçebilirsiniz.">
      <div className="not-prose grid gap-6 sm:grid-cols-2 mt-8">
        <ContactCard
          icon={<Mail className="h-6 w-6" />}
          title="E-posta"
          value="destek@karnet.com"
          href="mailto:destek@karnet.com"
        />
        <ContactCard
          icon={<Phone className="h-6 w-6" />}
          title="Telefon"
          value="+90 5XX XXX XX XX"
        />
        <ContactCard
          icon={<MapPin className="h-6 w-6" />}
          title="Adres"
          value="Konya / Türkiye"
        />
        <ContactCard
          icon={<User className="h-6 w-6" />}
          title="Site Sahibi"
          value="Süleyman Hilmi İşbilir"
        />
      </div>
    </LegalPageLayout>
  );
}

function ContactCard({
  icon,
  title,
  value,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-start gap-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-base font-semibold text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  );

  if (href) {
    return <a href={href} className="no-underline">{content}</a>;
  }
  return content;
}
