import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "pulse" | "dark-ghost";
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export const GreenButton = forwardRef<HTMLButtonElement, Props>(function GreenButton(
  { className, variant = "primary", children, ...rest },
  ref,
) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-medium text-sm md:text-base transition-all duration-300 active:scale-[0.97] whitespace-nowrap";
  const styles: Record<Variant, string> = {
    primary:
      "shimmer-btn bg-[var(--gradient-green)] text-white shadow-[0_10px_30px_-8px_oklch(0.65_0.16_152/0.55)] hover:shadow-[0_18px_50px_-10px_oklch(0.65_0.16_152/0.7)]",
    pulse:
      "shimmer-btn bg-[var(--gradient-green)] text-white animate-pulse-glow",
    ghost:
      "border border-forest/15 text-forest hover:bg-forest/5 hover:border-forest/30 bg-white/40 backdrop-blur-md",
    "dark-ghost":
      "border border-white/20 text-white hover:bg-white/10 hover:border-white/40 backdrop-blur-md",
  };
  return (
    <button ref={ref} className={cn(base, styles[variant], className)} {...rest}>
      {children}
    </button>
  );
});
