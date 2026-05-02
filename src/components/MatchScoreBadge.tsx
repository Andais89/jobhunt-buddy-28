import { cn } from "@/lib/utils";

export function MatchScoreBadge({ score, className }: { score: number | null | undefined; className?: string }) {
  if (score === null || score === undefined) return null;
  const tone =
    score >= 80
      ? "bg-success/15 text-success border-success/30"
      : score >= 50
      ? "bg-accent/15 text-accent border-accent/40"
      : "bg-destructive/10 text-destructive border-destructive/30";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-editorial rounded-full border",
        tone,
        className,
      )}
      title={`Match score ${score}/100`}
    >
      Match {score}
    </span>
  );
}
