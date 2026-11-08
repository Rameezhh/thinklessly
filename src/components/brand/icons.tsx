import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconSvg({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function DashboardIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <rect x="3" y="3" width="7.5" height="9" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="2" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="2" />
      <rect x="3" y="15" width="7.5" height="6" rx="2" />
    </IconSvg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M13 3L5 13h6l-1 8 8-10h-6l1-8z" />
    </IconSvg>
  );
}

export function CodeIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
    </IconSvg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg
      width={props.size ?? 16}
      height={props.size ?? 16}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg
      width={props.size ?? 16}
      height={props.size ?? 16}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg
      width={props.size ?? 14}
      height={props.size ?? 14}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M13 8H3M7 4L3 8l4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg
      width={props.size ?? 18}
      height={props.size ?? 18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <svg
      width={props.size ?? 18}
      height={props.size ?? 18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 8l-4 4 4 4M6 12h10" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </IconSvg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </IconSvg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg
      width={props.size ?? 14}
      height={props.size ?? 14}
      viewBox="0 0 14 14"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 1.5v11l9-5.5-9-5.5z" fill="currentColor" />
    </svg>
  );
}

export function UpIcon(props: IconProps) {
  return (
    <svg
      width={props.size ?? 14}
      height={props.size ?? 14}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M8 13V3M4 7l4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DownIcon(props: IconProps) {
  return (
    <svg
      width={props.size ?? 14}
      height={props.size ?? 14}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M8 3v10M4 9l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <svg
      width={props.size ?? 20}
      height={props.size ?? 20}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <circle cx="8" cy="8" r="8" fill="currentColor" />
      <path
        d="M4.5 8.5l2.3 2.3 4.7-5.3"
        stroke="#0E0F13"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 012-2h9" />
    </IconSvg>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M16 7l3 3" />
    </IconSvg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v2.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V16" />
    </IconSvg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M4 12.5l4.5 4.5L20 5.5" />
    </IconSvg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </IconSvg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg
      width={props.size ?? 14}
      height={props.size ?? 14}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M6 3l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}