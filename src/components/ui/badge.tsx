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
  success: "pill pill-success",
  info: "pill pill-lime",
  warning: "pill pill-neutral",
  human: "pill pill-lime",
  danger: "pill pill-danger",
  neutral: "pill pill-neutral",
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
    <span className={`${toneClasses[tone]} ${className}`} {...props}>
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
  return (
    <Badge tone={meta.tone} className={className}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}