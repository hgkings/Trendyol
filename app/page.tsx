'use client';

import { Header } from '@/components/landing/header';
import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { HowItWorks } from '@/components/landing/how-it-works';
import { BenefitsList } from '@/components/landing/benefits-list';
import { CTASection } from '@/components/landing/cta-section';
import { TrendingUp } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <Header />

      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <BenefitsList />
        <CTASection />
      </main>

      <footer className="border-t py-12 bg-muted/30">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold tracking-tight">Kar Koçu</span>
          </div>

          <p className="text-xs text-muted-foreground text-center sm:text-right">
            © {new Date().getFullYear()} PazarYeri Kar Koçu. Tüm hakları saklıdır.
          </p>
        </div>
      </footer>
    </div>
  );
}
