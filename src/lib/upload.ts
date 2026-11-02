import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const UPLOAD_DIR = resolve("data/uploads");

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

export async function saveUploadedFile(file: File): Promise<string> {
  if (file.size === 0) {
    throw new UploadError("The uploaded file is empty.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("The uploaded file is larger than 25 MB.");
  }

  const safeName = basename(file.name)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(-80);

  await mkdir(UPLOAD_DIR, { recursive: true });
  const path = join(UPLOAD_DIR, `${randomUUID()}-${safeName || "upload"}`);
  await writeFile(path, new Uint8Array(await file.arrayBuffer()));
  return path;
}
