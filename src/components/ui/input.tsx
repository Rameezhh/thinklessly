import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export const inputClasses = "field";

export const monoInputClasses = "field field-sm";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClasses} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputClasses} ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputClasses} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Label({
  className = "",
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`label ${className}`} {...props}>
      {children}
    </label>
  );
}