import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="animate-fade rounded-2xl border-[1.5px] border-dashed border-[#D8D6CE] bg-[#FBFBF9] px-6 py-12 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F0EB] text-[#14151A]">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-4 text-base font-semibold text-[#14151A]">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-[#5C6070]">
          {description}
        </p>
      ) : null}
      {actions ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}