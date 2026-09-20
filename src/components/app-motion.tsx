"use client";

import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";

const routeTransition = {
  duration: 0.2,
  ease: [0.2, 0, 0, 1] as const,
};

export function AppMotion({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={pathname}
          className="route-motion"
          initial={shouldReduceMotion ? false : { opacity: 0.94, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
          transition={shouldReduceMotion ? { duration: 0 } : routeTransition}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
