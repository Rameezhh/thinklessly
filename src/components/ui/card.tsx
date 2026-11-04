import type { HTMLAttributes } from "react";

const base =
  "rounded-2xl border border-zinc-200/80 bg-white/90 shadow-sm shadow-zinc-950/[0.03] backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/80";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={`${base} ${className}`} {...props} />;
}

export function CardHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200/70 px-5 py-4 dark:border-zinc-800/70 ${className}`}
      {...props}
    />
  );
}

export function CardTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={`text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 ${className}`}
      {...props}
    />
  );
}

export function CardDescription({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 ${className}`} {...props} />
  );
}

export function CardBody({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-5 py-4 ${className}`} {...props} />;
}

export function CardFooter({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 border-t border-zinc-200/70 px-5 py-4 dark:border-zinc-800/70 ${className}`}
      {...props}
    />
  );
}
