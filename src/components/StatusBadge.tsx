import { AppStatus, STATUS_LABEL, STATUS_TONE } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: AppStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 border text-[10px] uppercase tracking-editorial font-semibold",
        STATUS_TONE[status],
        className
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
