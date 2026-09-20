"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import Image from "next/image";
import Link from "next/link";

import { LandingActions } from "@/components/landing-actions";

const group: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.08 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  },
};

export function LandingHero({ clerkConfigured }: Readonly<{ clerkConfigured: boolean }>) {
  const shouldReduceMotion = Boolean(useReducedMotion());

  return (
    <section className="landing-hero" aria-labelledby="landing-title">
      <motion.div
        className="hero-copy"
        variants={shouldReduceMotion ? undefined : group}
        initial={shouldReduceMotion ? false : "hidden"}
        animate={shouldReduceMotion ? undefined : "visible"}
      >
        <motion.p className="hero-kicker" variants={shouldReduceMotion ? undefined : item}>
          A job search built around you
        </motion.p>
        <motion.h1 id="landing-title" variants={shouldReduceMotion ? undefined : item}>
          Find work that fits <span className="marker-underline">your experience</span>.
        </motion.h1>
        <motion.p className="hero-lede" variants={shouldReduceMotion ? undefined : item}>
          Start with your resume. Build a profile you trust. Discover relevant roles with clear
          reasons behind every match.
        </motion.p>
        <motion.div className="hero-actions" variants={shouldReduceMotion ? undefined : item}>
          {clerkConfigured ? (
            <LandingActions mode="hero" />
          ) : (
            <>
              <Link href="/sign-up" className="button-primary">
                Start With Your Resume
              </Link>
              <Link href="#workflow-title" className="button-secondary">
                See how it works
              </Link>
            </>
          )}
        </motion.div>
      </motion.div>

      <motion.figure
        className="hero-visual"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 26, rotate: 1.5 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }
        }
      >
        <div className="hero-visual-image">
          <Image
            src="/images/landing/resume-match-lens-v2.png"
            alt="Resume evidence passing through a lens into ranked job opportunities"
            width={1122}
            height={1402}
            priority
            sizes="(max-width: 767px) 100vw, 50vw"
          />
        </div>
      </motion.figure>
    </section>
  );
}
