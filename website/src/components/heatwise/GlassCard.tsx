import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = HTMLMotionProps<"div"> & {
  glow?: boolean;
  hover?: boolean;
};

export function GlassCard({ className, glow, hover = true, children, ...rest }: Props) {
  return (
    <motion.div
      whileHover={
        hover
          ? { y: -4, boxShadow: "var(--shadow-card-hover)" }
          : undefined
      }
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className={cn(
        "bg-card rounded-2xl p-6 relative border border-forest/8 shadow-[var(--shadow-card)]",
        glow && "ring-1 ring-green/40 shadow-[var(--shadow-glow)]",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
