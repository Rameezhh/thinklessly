import type { SVGProps } from "react";

type LogoVariant = "lime" | "ink";

export function LogoMark({
  variant = "lime",
  size = 34,
  ...props
}: SVGProps<SVGSVGElement> & { variant?: LogoVariant; size?: number }) {
  const dark = variant === "ink";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <rect width="40" height="40" rx="11" fill={dark ? "#0E0F13" : "#C8F23B"} />
      <rect
        x="10"
        y="11"
        width="20"
        height="5.5"
        rx="2.75"
        fill={dark ? "#FFFFFF" : "#0E0F13"}
      />
      <rect
        x="17.25"
        y="11"
        width="5.5"
        height="19"
        rx="2.75"
        fill={dark ? "#FFFFFF" : "#0E0F13"}
      />
      <circle
        cx="31"
        cy="31"
        r="5.5"
        fill={dark ? "#C8F23B" : "#0E0F13"}
        stroke={dark ? "#0E0F13" : "#C8F23B"}
        strokeWidth="2.5"
      />
    </svg>
  );
}

export function Logo({
  variant = "lime",
  size = 34,
  wordmarkSize = 22,
  showWordmark = true,
  wordmarkColor = "currentColor",
  className = "",
  markClassName = "",
}: {
  variant?: LogoVariant;
  size?: number;
  wordmarkSize?: number;
  showWordmark?: boolean;
  wordmarkColor?: string;
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark variant={variant} size={size} className={markClassName} />
      {showWordmark ? (
        <span
          className="display"
          style={{
            color: wordmarkColor,
            fontSize: wordmarkSize,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          Thinklessly
        </span>
      ) : null}
    </span>
  );
}