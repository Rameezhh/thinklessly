import type { InputHTMLAttributes, ReactNode } from "react";

export const checkboxClasses =
  "h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-300 accent-[#0E0F13] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8F23B] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

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
      className={`flex cursor-pointer items-start gap-3.5 rounded-2xl border-[1.5px] border-[#CFE58A] bg-[#FAFDEB] px-5 py-4 text-sm transition-colors hover:border-[#b9d46a] ${className}`}
    >
      <Checkbox className="mt-0.5 h-5 w-5" {...props} />
      <span className="min-w-0">
        <span className="block text-base font-semibold text-[#14151A]">{label}</span>
        {description ? (
          <span className="mt-1 block text-sm leading-relaxed text-[#4A4E5C]">{description}</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}