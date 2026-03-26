"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Feature {
  name: string
  description: string
  included: boolean
}

interface PricingTier {
  name: string
  price: {
    monthly: number
    yearly: number
  }
  description: string
  features: Feature[]
  highlight?: boolean
  badge?: string
  icon: React.ReactNode
  /** Called when the CTA button is clicked */
  onAction?: () => void
  /** Custom label for the CTA button */
  actionLabel?: string
}

interface PricingSectionProps {
  tiers: PricingTier[]
  className?: string
  /** Fired when the user switches billing cycle */
  onBillingChange?: (isYearly: boolean) => void
}

function PricingSection({ tiers, className, onBillingChange }: PricingSectionProps) {
  const [isYearly, setIsYearly] = useState(false)

  const handlePeriodChange = (period: string) => {
    const yearly = period === "Yearly"
    setIsYearly(yearly)
    onBillingChange?.(yearly)
  }

  const colClass = tiers.length === 3
    ? "grid-cols-1 md:grid-cols-3"
    : "grid-cols-1 md:grid-cols-2"

  return (
    <section
      className={cn(
        "relative bg-background text-foreground",
        "py-12 px-4 md:py-24 lg:py-32",
        "overflow-hidden",
        className,
      )}
    >
      <div className="w-full max-w-6xl mx-auto">
        <div className="flex flex-col items-center gap-4 mb-12">
          <div className="inline-flex items-center p-1.5 bg-[rgba(255,255,255,0.04)] rounded-full border border-[rgba(255,255,255,0.06)]">
            {["Monthly", "Yearly"].map((period) => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={cn(
                  "px-8 py-2.5 text-sm font-medium rounded-full transition-all duration-300",
                  (period === "Yearly") === isYearly
                    ? "bg-amber-500/20 text-amber-400 shadow-lg"
                    : "text-[rgba(255,255,255,0.4)] hover:text-foreground",
                )}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className={cn("grid gap-8", colClass)}>
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "relative group",
                "rounded-3xl transition-all duration-300",
                "flex flex-col",
                tier.highlight
                  ? "bg-[rgba(217,119,6,0.08)] border border-amber-500/30 shadow-xl"
                  : "bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] shadow-md",
                "hover:translate-y-0 hover:shadow-lg",
              )}
            >
              {tier.badge && tier.highlight && (
                <div className="absolute -top-4 left-6">
                  <Badge className="px-4 py-1.5 text-sm font-medium text-white border-none shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}>
                    {tier.badge}
                  </Badge>
                </div>
              )}

              <div className="p-8 flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={cn(
                      "p-3 rounded-xl",
                      tier.highlight
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.5)]",
                    )}
                  >
                    {tier.icon}
                  </div>
                  <h3 className={cn("text-xl font-semibold", tier.highlight ? "text-amber-400" : "text-foreground")}>
                    {tier.name}
                  </h3>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-foreground">
                      ₺{isYearly ? tier.price.yearly : tier.price.monthly}
                    </span>
                    <span className="text-sm text-[rgba(255,255,255,0.4)]">
                      /{isYearly ? "yıl" : "ay"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[rgba(255,255,255,0.5)]">
                    {tier.description}
                  </p>
                </div>

                <div className="space-y-4">
                  {tier.features.map((feature) => (
                    <div key={feature.name} className="flex gap-4">
                      <div
                        className={cn(
                          "mt-1 p-0.5 rounded-full transition-colors duration-200",
                          feature.included
                            ? "text-emerald-400"
                            : "text-[rgba(255,255,255,0.2)]",
                        )}
                      >
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <div className={cn("text-sm font-medium", feature.included ? "text-foreground" : "text-[rgba(255,255,255,0.4)]")}>
                          {feature.name}
                        </div>
                        <div className="text-sm text-[rgba(255,255,255,0.4)]">
                          {feature.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-8 pt-0 mt-auto">
                <Button
                  className={cn(
                    "w-full relative transition-all duration-300 rounded-xl h-12",
                    tier.highlight
                      ? "text-white"
                      : "border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] hover:bg-white/10 text-foreground",
                  )}
                  style={tier.highlight ? { background: 'linear-gradient(135deg, #D97706, #92400E)' } : undefined}
                  onClick={tier.onAction}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {tier.actionLabel ?? (tier.highlight ? "Pro'ya Geç" : "Ücretsiz Başla")}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export { PricingSection }
export type { PricingTier, Feature }
