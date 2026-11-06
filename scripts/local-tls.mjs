import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const certDir = resolve(root, "data", "local-tls");
const caKey = resolve(certDir, "ca.key");
const caCert = resolve(certDir, "ca.crt");
const serverKey = resolve(certDir, "server.key");
const serverCsr = resolve(certDir, "server.csr");
const serverCert = resolve(certDir, "server.crt");
const serverExt = resolve(certDir, "server.ext");

mkdirSync(certDir, { recursive: true });

const env = { ...process.env, MSYS_NO_PATHCONV: "1" };

function run(args) {
  execFileSync("openssl", args, { stdio: "inherit", env });
}

try {
  execFileSync("openssl", ["version"], { stdio: "ignore", env });
} catch {
  console.error("[sim] openssl was not found. Install OpenSSL and run pnpm sim:tls again.");
  process.exit(1);
}

if (!existsSync(caKey) || !existsSync(caCert)) {
  console.log("[sim] creating local certificate authority");
  run([
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-sha256",
    "-nodes",
    "-days",
    "825",
    "-keyout",
    caKey,
    "-out",
    caCert,
    "-subj",
    "/CN=Thinklessly Local Dev CA",
    "-addext",
    "basicConstraints=critical,CA:TRUE",
    "-addext",
    "keyUsage=critical,keyCertSign,cRLSign",
  ]);
}

console.log("[sim] creating localhost server certificate");
run([
  "req",
  "-newkey",
  "rsa:2048",
  "-sha256",
  "-nodes",
  "-keyout",
  serverKey,
  "-out",
  serverCsr,
  "-subj",
  "/CN=localhost",
]);

writeFileSync(
  serverExt,
  [
    "basicConstraints=CA:FALSE",
    "keyUsage=digitalSignature,keyEncipherment",
    "extendedKeyUsage=serverAuth",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
    "",
  ].join("\n"),
);

run([
  "x509",
  "-req",
  "-in",
  serverCsr,
  "-CA",
  caCert,
  "-CAkey",
  caKey,
  "-CAcreateserial",
  "-out",
  serverCert,
  "-days",
  "825",
  "-sha256",
  "-extfile",
  serverExt,
]);

if (process.platform === "win32") {
  try {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Import-Certificate -FilePath '${caCert}' -CertStoreLocation 'Cert:\\CurrentUser\\Root' | Out-Null`,
      ],
      { stdio: "inherit" },
    );
    console.log("[sim] trusted the local CA for the current Windows user");
  } catch {
    console.warn(
      "[sim] could not add the CA to the Windows trust store automatically.\n" +
        `      Run: certutil -addstore -user Root "${caCert}"`,
    );
  }
} else {
  console.log(
    `[sim] add this CA to your system trust store so the browser accepts it:\n      ${caCert}`,
  );
}

console.log(`[sim] certificates ready in ${certDir}`);