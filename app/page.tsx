'use client';

import { Header } from '@/components/landing/header';
import { Hero } from '@/components/landing/hero';
import { SocialProofBar } from '@/components/landing/social-proof-bar';
import { QuickCalc } from '@/components/landing/quick-calc';
import { Features } from '@/components/landing/features';
import { Testimonials } from '@/components/landing/testimonials';
import { HowItWorks } from '@/components/landing/how-it-works';
import { BenefitsList } from '@/components/landing/benefits-list';
import { TrustStrip } from '@/components/landing/trust-strip';
import { FAQSection } from '@/components/landing/faq-section';
import { CTASection } from '@/components/landing/cta-section';
import { TrendingUp } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <Header />

      <main>
        <Hero />
        <SocialProofBar />
        <QuickCalc />
        <Features />
        <Testimonials />
        <HowItWorks />
        <BenefitsList />
        <TrustStrip />
        <FAQSection />
        <CTASection />
      </main>

      <footer className="border-t py-12 bg-muted/30">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="relative h-8 w-auto">
              <img src="/brand/logo.svg" alt="Kârnet" width="160" height="40" className="h-8 w-auto dark:hidden" />
              <img src="/brand/logo-dark.svg" alt="Kârnet" width="160" height="40" className="h-8 w-auto hidden dark:block" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center sm:text-right">
            © {new Date().getFullYear()} Kârnet. Tüm hakları saklıdır.
          </p>
        </div>
      </footer>
    </div>
  );
}
