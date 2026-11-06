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
      return "pill pill-success";
    case "FAILED":
      return "pill pill-danger";
    case "RUNNING":
    case "NEEDS_HUMAN":
      return "pill pill-lime";
    default:
      return "pill pill-neutral";
  }
}

export function isActiveStatus(status: string): boolean {
  return status === "QUEUED" || status === "RUNNING";
}