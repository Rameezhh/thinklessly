import { createServer as createHttpsServer } from "node:https";
import { request } from "node:http";
import { connect } from "node:net";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const certDir = resolve(root, "data", "local-tls");

const appPort = Number(process.env.SIM_APP_PORT ?? 3010);
const wispPort = Number(process.env.SIM_WISP_PORT ?? 4002);
const proxyPort = Number(process.env.SIM_PROXY_PORT ?? 8443);
const host = "127.0.0.1";

const key = readFileSync(resolve(certDir, "server.key"));
const cert = readFileSync(resolve(certDir, "server.crt"));

function isWisp(url) {
  return url === "/live/wisp" || url.startsWith("/live/wisp/") || url.startsWith("/live/wisp?");
}

function forwardedHeaders(request_) {
  const headers = { ...request_.headers };
  headers.host = `localhost:${proxyPort}`;
  headers["x-forwarded-host"] = `localhost:${proxyPort}`;
  headers["x-forwarded-proto"] = "https";
  headers["x-forwarded-for"] = request_.socket.remoteAddress ?? "";
  return headers;
}

function proxyHttp(port, request_, response_) {
  const upstream = request(
    {
      host,
      port,
      method: request_.method,
      path: request_.url,
      headers: forwardedHeaders(request_),
    },
    (upstreamResponse) => {
      response_.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response_);
    },
  );

  upstream.on("error", () => {
    if (!response_.headersSent) response_.writeHead(502, { "content-type": "text/plain" });
    response_.end("Bad gateway");
  });

  request_.pipe(upstream);
}

const server = createHttpsServer({ key, cert }, (request_, response_) => {
  proxyHttp(isWisp(request_.url ?? "") ? wispPort : appPort, request_, response_);
});

server.on("upgrade", (request_, socket, head) => {
  const path = request_.url ?? "/";
  const port = isWisp(path) ? wispPort : appPort;

  const upstream = connect(port, host, () => {
    const lines = [`${request_.method} ${path} HTTP/1.1`];
    for (let index = 0; index < request_.rawHeaders.length; index += 2) {
      const name = request_.rawHeaders[index];
      const value =
        name.toLowerCase() === "host" ? `localhost:${proxyPort}` : request_.rawHeaders[index + 1];
      lines.push(`${name}: ${value}`);
    }
    lines.push("", "");
    upstream.write(lines.join("\r\n"));
    if (head?.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(proxyPort, () => {
  console.log(`[sim-proxy] https://localhost:${proxyPort}`);
  console.log(`[sim-proxy]   /            -> 127.0.0.1:${appPort}`);
  console.log(`[sim-proxy]   /live/wisp/  -> 127.0.0.1:${wispPort} (websocket)`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);