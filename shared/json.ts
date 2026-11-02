export function toJson(value: unknown): string {
  return JSON.stringify(value);
}

export function fromJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function fromJsonOrThrow<T>(value: string | null | undefined): T {
  if (!value) {
    throw new Error("Expected JSON value but got an empty value");
  }
  return JSON.parse(value) as T;
}
