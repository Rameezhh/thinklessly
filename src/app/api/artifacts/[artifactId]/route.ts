import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { prisma } from "@shared/db";
import { requireUser } from "@/lib/session";

const contentTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ artifactId: string }> },
) {
  const user = await requireUser();
  const { artifactId } = await params;

  const artifact = await prisma.runArtifact.findFirst({
    where: { id: artifactId, run: { teamId: user.teamId } },
    select: { path: true },
  });
  if (!artifact) {
    return new Response("Not found", { status: 404 });
  }

  const root = resolve("data/artifacts");
  const filePath = resolve(artifact.path);
  const rootPrefix = `${root.toLowerCase()}${sep}`;
  if (!filePath.toLowerCase().startsWith(rootPrefix)) {
    return new Response("Not found", { status: 404 });
  }

  let data: Buffer;
  try {
    data = await readFile(filePath);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const contentType = contentTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
