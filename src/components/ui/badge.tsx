import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Loader2,
  PauseCircle,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";
import type { HTMLAttributes } from "react";

const toneClasses = {
  success:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/20",
  info: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-400/20",
  warning:
    "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-400/20",
  human:
    "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-400/20",
  danger:
    "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-400/20",
  neutral:
    "bg-zinc-100 text-zinc-600 ring-zinc-500/15 dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-zinc-500/20",
} as const;

export type BadgeTone = keyof typeof toneClasses;

export function Badge({
  tone = "neutral",
  icon: Icon,
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; icon?: LucideIcon }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClasses[tone]} ${className}`}
      {...props}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {children}
    </span>
  );
}

const statusMeta: Record<string, { tone: BadgeTone; icon: LucideIcon }> = {
  SUCCESS: { tone: "success", icon: CheckCircle2 },
  ACTIVE: { tone: "success", icon: CheckCircle2 },
  RUNNING: { tone: "info", icon: Loader2 },
  QUEUED: { tone: "warning", icon: Clock3 },
  DRAFT: { tone: "warning", icon: CircleDashed },
  NEEDS_HUMAN: { tone: "human", icon: PauseCircle },
  FAILED: { tone: "danger", icon: AlertTriangle },
  CANCELLED: { tone: "neutral", icon: Ban },
  PAUSED: { tone: "human", icon: PauseCircle },
  READY: { tone: "info", icon: PlayCircle },
};

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const meta = statusMeta[status] ?? { tone: "neutral" as const, icon: CircleDashed };
  const Icon = meta.icon;
  const spinning = status === "RUNNING";
  return (
    <Badge tone={meta.tone} className={className}>
      <Icon className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`} aria-hidden />
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
