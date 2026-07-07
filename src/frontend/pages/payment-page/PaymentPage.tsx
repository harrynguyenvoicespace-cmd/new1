"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, Zap } from "lucide-react";
import styles from "./payment-page.module.css";

type BillingPeriod = "monthly" | "yearly";
type PlanVariant = "muted" | "current" | "dark";

type Plan = {
  id?: string;
  title: string;
  description: string;
  monthly: number;
  yearly: number;
  cta: string;
  variant: PlanVariant;
  featured?: boolean;
  features: string[];
};

const plans: Plan[] = [
  {
    title: "Free",
    description: "Perfect for hobbyists, students, or early-stage creators.",
    monthly: 0,
    yearly: 0,
    cta: "You're on Creator",
    variant: "muted",
    features: [
      "Access to a basic asset library",
      "15-second video animation",
      "Generate up to 10 scenes/month",
      "Watermarked exports",
      "Try basic AI prompts",
    ],
  },
  {
    title: "Creator",
    description: "For indie creators, and startups who need high-quality output",
    monthly: 20,
    yearly: 192,
    cta: "Current Plan",
    variant: "current",
    featured: true,
    features: [
      "Everything in Free",
      "Unlimited 3D scene generation",
      "Premium asset library access",
      "Animations up to 30 seconds",
      "20+ Video AI models",
    ],
  },
  {
    id: "studio",
    title: "Studio",
    description: "For teams and studios that need power, speed.",
    monthly: 40,
    yearly: 384,
    cta: "Get Studio",
    variant: "dark",
    features: [
      "Everything in Creator",
      "Unlimited 3D scene generation",
      "Full access to premium asset library",
      "Animations up to 60 seconds",
      "Unlimited Video AI models",
    ],
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function PaymentPage() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const isYearly = billingPeriod === "yearly";

  return (
    <main className={styles.stage}>
      <section className={styles.paymentWindow} aria-labelledby="page-title">
        <header className={styles.appHeader}>
          <Link className={styles.brand} href="/dashboard" aria-label="Brainwave home">
            <span className={styles.brandMark} aria-hidden="true" />
            <span>Brainwave</span>
          </Link>

          <nav className={styles.headerActions} aria-label="Quick actions">
            <button className={styles.iconButton} aria-label="Search" type="button">
              <Search size={19} />
            </button>
            <button className={cx(styles.iconButton, styles.hasDot)} aria-label="Activity" type="button">
              <Zap size={19} />
            </button>
            <button className={styles.avatarButton} aria-label="Open profile" type="button" />
          </nav>
        </header>

        <div className={styles.content}>
          <h1 id="page-title" className={styles.pageTitle}>Choose your plan</h1>

          <div className={styles.billingToggle} role="group" aria-label="Billing period">
            {(["monthly", "yearly"] as const).map((period) => (
              <button
                key={period}
                className={cx(styles.billingOption, billingPeriod === period && styles.active)}
                type="button"
                onClick={() => setBillingPeriod(period)}
                aria-pressed={billingPeriod === period}
              >
                {period === "monthly" ? "Pay monthly" : "Pay yearly"}
                {period === "yearly" ? <span className={styles.savingDot} aria-hidden="true" /> : null}
              </button>
            ))}
          </div>

          <div className={styles.pricingGrid} aria-label="Pricing plans">
            {plans.map((plan) => (
              <article
                key={plan.title}
                id={plan.id}
                className={cx(styles.planCard, plan.featured && styles.featured)}
              >
                {plan.featured ? (
                  <div className={styles.imageStrip}>
                    <div className={styles.planTitle}>{plan.title}</div>
                  </div>
                ) : (
                  <div className={styles.planTitle}>{plan.title}</div>
                )}

                <div className={styles.planBody}>
                  <p>{plan.description}</p>
                  <div className={styles.priceBox}>
                    <div className={styles.priceRow}>
                      <span className={styles.currency}>$</span>
                      <strong>{plan[billingPeriod]}</strong>
                      <span className={styles.priceMeta}>
                        USD /<br />{isYearly ? "year" : "month"}
                      </span>
                    </div>
                    <button
                      className={cx(
                        styles.planButton,
                        plan.variant === "dark" ? styles.dark : styles.muted,
                        plan.variant === "current" && styles.strong,
                      )}
                      type="button"
                    >
                      {plan.cta}
                    </button>
                  </div>

                  <ul className={styles.features}>
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}