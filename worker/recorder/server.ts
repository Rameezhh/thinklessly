import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isHttpUrl } from "@shared/definition";
import { WebSocketServer } from "ws";
import { RecorderSession } from "./session";

const MAX_BODY_BYTES = 1_000_000;
const SESSION_RETENTION_MS = 10 * 60 * 1000;

const startSchema = z.object({
  startUrl: z.string().refine(isHttpUrl, "URL must use http:// or https://"),
  captureData: z.boolean().default(true),
});

type RecorderServerOptions = {
  port: number;
  maxSessions: number;
};

export type RecorderServerHandle = {
  port: number;
  stop: () => Promise<void>;
};

function isLocalOrigin(origin: string | undefined): boolean {
  return !origin || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(origin);
}

function setCors(request: IncomingMessage, response: ServerResponse): void {
  const origin = request.headers.origin;
  if (origin && isLocalOrigin(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Max-Age", "600");
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function startRecorderServer(options: RecorderServerOptions): Promise<RecorderServerHandle> {
  const sessions = new Map<string, RecorderSession>();
  const cleanupTimers = new Set<ReturnType<typeof setTimeout>>();
  const wss = new WebSocketServer({ noServer: true });

  function activeCount(): number {
    return [...sessions.values()].filter((session) => {
      const status = session.snapshot().status;
      return status === "starting" || status === "recording" || status === "stopping";
    }).length;
  }

  function scheduleCleanup(sessionId: string): void {
    const timer = setTimeout(() => {
      cleanupTimers.delete(timer);
      sessions.delete(sessionId);
    }, SESSION_RETENTION_MS);
    timer.unref();
    cleanupTimers.add(timer);
  }

  const server = createServer(async (request, response) => {
    setCors(request, response);

    if (!isLocalOrigin(request.headers.origin)) {
      json(response, 403, { error: "Recorder requests are limited to localhost." });
      return;
    }

    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;

    try {
      if (request.method === "GET" && path === "/health") {
        json(response, 200, { ok: true, activeSessions: activeCount() });
        return;
      }

      if (request.method === "POST" && path === "/sessions") {
        if (activeCount() >= options.maxSessions) {
          json(response, 409, { error: "Another recording is already open. Finish or cancel it first." });
          return;
        }

        const parsed = startSchema.safeParse(await readBody(request));
        if (!parsed.success) {
          json(response, 400, { error: parsed.error.issues[0]?.message ?? "Invalid start URL." });
          return;
        }

        const sessionId = randomUUID();
        const session = new RecorderSession(sessionId, parsed.data.startUrl, {
          captureData: parsed.data.captureData,
        });
        sessions.set(sessionId, session);

        try {
          await session.start();
        } catch (error) {
          sessions.delete(sessionId);
          await session.shutdown().catch(() => undefined);
          console.error(`[recorder] could not start session ${sessionId}: ${errorMessage(error)}`);
          json(response, 502, { error: "Could not open the recording browser. Check the URL and try again." });
          return;
        }

        console.log(`[recorder] started session ${sessionId}`);
        json(response, 201, { sessionId });
        return;
      }

      const match = /^\/sessions\/([0-9a-f-]+)(\/stop)?$/.exec(path);
      const sessionId = match?.[1];
      const action = match?.[2];
      const session = sessionId ? sessions.get(sessionId) : undefined;

      if (sessionId && !session) {
        json(response, 404, { error: "Recording session not found." });
        return;
      }

      if (session && request.method === "GET" && !action) {
        json(response, 200, session.snapshot());
        return;
      }

      if (session && request.method === "POST" && action === "/stop") {
        const snapshot = await session.stop();
        scheduleCleanup(session.id);
        json(response, 200, snapshot);
        return;
      }

      if (session && request.method === "DELETE" && !action) {
        await session.stop().catch(() => undefined);
        sessions.delete(session.id);
        session.closeClients();
        json(response, 200, { ok: true });
        return;
      }

      json(response, 404, { error: "Not found." });
    } catch (error) {
      console.error(`[recorder] request failed: ${errorMessage(error)}`);
      if (!response.headersSent) json(response, 500, { error: "Recorder request failed." });
    }
  });

  server.on("upgrade", (request, socket, head) => {
    if (!isLocalOrigin(request.headers.origin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const match = /^\/sessions\/([0-9a-f-]+)\/ws$/.exec(url.pathname);
    const session = match?.[1] ? sessions.get(match[1]) : undefined;

    if (!session) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (client) => {
      session.addClient(client);
      client.on("close", () => session.removeClient(client));
      client.on("error", () => session.removeClient(client));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  return {
    port: options.port,
    stop: async () => {
      for (const timer of cleanupTimers) clearTimeout(timer);
      cleanupTimers.clear();
      await Promise.allSettled([...sessions.values()].map((session) => session.shutdown()));
      sessions.clear();
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
