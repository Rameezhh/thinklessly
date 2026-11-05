import "dotenv/config";
import { createServer } from "node:http";
import { lookup } from "node:dns/promises";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import ipaddr from "ipaddr.js";

const port = Number(process.env.WISP_PORT ?? 4002);

const BLOCKED_RANGES = new Set([
  "unspecified",
  "loopback",
  "broadcast",
  "linkLocal",
  "carrierGradeNat",
  "private",
  "reserved",
  "uniqueLocal",
  "rfc6145",
  "rfc6052",
  "6to4",
  "teredo",
]);

function normalizeAddress(value: string): ipaddr.IPv4 | ipaddr.IPv6 | null {
  if (!ipaddr.isValid(value)) return null;
  const parsed = ipaddr.parse(value);
  if (parsed.kind() === "ipv6") {
    const ipv6 = parsed as ipaddr.IPv6;
    if (ipv6.isIPv4MappedAddress()) return ipv6.toIPv4Address();
  }
  return parsed;
}

function isBlocked(address: string): boolean {
  const parsed = normalizeAddress(address);
  if (!parsed) return true;
  if (parsed.kind() === "ipv4") {
    const ipv4 = parsed as ipaddr.IPv4;
    if (ipv4.range() === "private" || ipv4.range() === "loopback") return true;
  }
  return BLOCKED_RANGES.has(parsed.range());
}

// Resolve every address for a hostname and refuse if any is non-public. This
// blocks DNS rebinding (mixed public/private records) and closes the IPv6
// unique-local / NAT64 gaps that the upstream range list does not cover.
async function resolveStrict(hostname: string): Promise<string> {
  const records = await lookup(hostname, { all: true });
  if (records.length === 0) throw new Error(`No DNS records for ${hostname}`);
  for (const record of records) {
    if (isBlocked(record.address)) {
      throw new Error(`Blocked address for ${hostname}`);
    }
  }
  // Prefer IPv4: many environments have broken IPv6 routes, which would make
  // the first request to a host stall until the OS connect timeout.
  const ipv4 = records.filter((record) => record.family === 4);
  const preferred = ipv4.length > 0 ? ipv4 : records;
  return preferred[0]!.address;
}

logging.set_level(process.env.WISP_DEBUG === "1" ? logging.DEBUG : logging.WARN);
Object.assign(wisp.options, {
  allow_udp_streams: false,
  allow_tcp_streams: true,
  allow_direct_ip: false,
  allow_private_ips: false,
  allow_loopback_ips: false,
  hostname_blacklist: [/^localhost$/i, /\.local$/i, /\.internal$/i, /^metadata/i],
  port_blacklist: [25, 135, 137, 139, 445, 465, 587, 6379, 11211],
  stream_limit_total: 2048,
  stream_limit_per_host: 256,
  dns_method: resolveStrict,
  dns_ttl: 300,
  // Larger relay buffer = fewer round-trips and better throughput on API bursts.
  send_buffer_size: 1024,
});

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  response.end("wisp ok\n");
});

server.on("upgrade", (request, socket, head) => {
  if (!request.url || !request.url.endsWith("/")) {
    socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
    return;
  }
  console.log(`[wisp] upgrade ${request.url} origin=${request.headers.origin ?? "-"}`);
  wisp.routeRequest(request, socket, head);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[wisp] listening on 0.0.0.0:${port}`);
});

function shutdown(): void {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
