"use client";

import { motion, useReducedMotion } from "motion/react";

type MotionRevealProps = Readonly<{
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}>;

export function MotionReveal({ children, className, labelledBy }: MotionRevealProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section
      className={className}
      aria-labelledby={labelledBy}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={
        shouldReduceMotion ? { duration: 0 } : { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const }
      }
    >
      {children}
    </motion.section>
  );
}
