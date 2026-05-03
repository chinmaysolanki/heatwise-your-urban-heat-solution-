import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function StatBadge({
  icon,
  label,
  delay = 0,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      className={cn(
        "bg-white/90 backdrop-blur-md border border-forest/10 shadow-[var(--shadow-card)] rounded-full px-4 py-2.5 flex items-center gap-2 text-sm font-mono text-forest",
        "animate-bob",
        className,
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      <span className="text-green">{icon}</span>
      <span>{label}</span>
    </motion.div>
  );
}
