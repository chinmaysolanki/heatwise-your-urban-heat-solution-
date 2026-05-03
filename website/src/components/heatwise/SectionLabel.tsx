import { cn } from "@/lib/utils";

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-green",
        className,
      )}
    >
      <span className="h-px w-8 bg-green/60" />
      {children}
    </div>
  );
}
