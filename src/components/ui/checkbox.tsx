import type { InputHTMLAttributes, ReactNode } from "react";

export const checkboxClasses =
  "h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-300 text-indigo-600 accent-indigo-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-900";

export function Checkbox({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={`${checkboxClasses} ${className}`} {...props} />;
}

export function CheckboxField({
  label,
  description,
  className = "",
  children,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 ${className}`}
    >
      <Checkbox className="mt-0.5" {...props} />
      <span className="min-w-0">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {description}
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}
