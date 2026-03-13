import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

interface LegalPageLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function LegalPageLayout({ title, description, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 py-12 md:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-10 text-center">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {description && (
              <p className="mt-3 text-lg text-muted-foreground max-w-xl mx-auto">
                {description}
              </p>
            )}
            <div className="mt-6 h-1 w-16 bg-primary/60 rounded-full mx-auto" />
          </div>

          {/* Content — manual typography styles */}
          <article className="legal-content space-y-5 text-muted-foreground leading-relaxed
            [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-3
            [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2
            [&_p]:leading-relaxed
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5
            [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1.5
            [&_li]:leading-relaxed
            [&_strong]:text-foreground [&_strong]:font-semibold
            [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80
          ">
            {children}
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
