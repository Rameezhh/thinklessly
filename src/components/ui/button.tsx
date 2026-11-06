import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "lime";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary: "btn-dark",
  secondary: "btn-outline",
  ghost: "btn-ghost",
  danger: "btn-danger",
  lime: "btn-lime",
};

const sizes: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
  icon: "h-9 w-9 !px-0",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = "",
): string {
  return ["btn", variants[variant], sizes[size], className].filter(Boolean).join(" ");
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}