import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0E0F13] text-[#C8F23B]">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
          <h1 className="display text-balance text-[38px] sm:text-[44px]">{title}</h1>
          {description ? (
            <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-[#5C6070]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}