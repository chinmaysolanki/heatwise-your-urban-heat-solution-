import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = HTMLMotionProps<"section"> & { stagger?: boolean };

export function AnimatedSection({ className, stagger = true, children, ...rest }: Props) {
  return (
    <motion.section
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: {},
        show: stagger
          ? { transition: { delayChildren: 0.1, staggerChildren: 0.08 } }
          : {},
      }}
      className={cn("relative", className)}
      {...rest}
    >
      {children}
    </motion.section>
  );
}

export const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};
