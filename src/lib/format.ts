const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

export function statusClasses(status: string): string {
  switch (status) {
    case "SUCCESS":
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300";
    case "RUNNING":
      return "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950 dark:text-blue-300";
    case "QUEUED":
    case "DRAFT":
      return "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300";
    case "NEEDS_HUMAN":
      return "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-950 dark:text-purple-300";
    case "FAILED":
      return "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950 dark:text-red-300";
    case "CANCELLED":
      return "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300";
    default:
      return "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

export function isActiveStatus(status: string): boolean {
  return status === "QUEUED" || status === "RUNNING";
}
