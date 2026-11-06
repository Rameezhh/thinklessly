export function statusClass(status: string): string {
  switch (status) {
    case "SUCCESS":
    case "ACTIVE":
      return "pill pill-success";
    case "FAILED":
      return "pill pill-danger";
    case "RUNNING":
      return "pill pill-lime";
    case "NEEDS_HUMAN":
      return "pill pill-lime";
    default:
      return "pill pill-neutral";
  }
}

export function StatusPill({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  const label = status.replaceAll("_", " ");
  return (
    <span className={`${statusClass(status)} ${className}`}>
      {status === "RUNNING" ? (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3F5A00]" aria-hidden />
      ) : null}
      {label}
    </span>
  );
}