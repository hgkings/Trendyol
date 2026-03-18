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
import { Footer } from '@/components/layout/footer';
export default function LandingPage() {
  return (
    <div className="min-h-screen text-foreground font-sans selection:bg-primary/20">
      {/* Animated background orbs */}
      <div className="bg-animated">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
        <div className="bg-orb bg-orb-4" />
      </div>

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

      <Footer />
    </div>
  );
}

