import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const release = process.argv.includes("--release");

function loadCapacitorEnv() {
  const file = path.join(root, ".env");
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key.startsWith("CAPACITOR_")) continue;
    if (process.env[key]) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadCapacitorEnv();

if (release) {
  delete process.env.CAPACITOR_ALLOW_CLEARTEXT;
  delete process.env.CAPACITOR_DEBUG_WEBVIEW;
}

const serverUrl = (process.env.CAPACITOR_SERVER_URL || "").trim().replace(/\/+$/, "");
if (serverUrl) process.env.CAPACITOR_SERVER_URL = serverUrl;
else delete process.env.CAPACITOR_SERVER_URL;

const loopbackHttp = /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/i;
if (serverUrl) {
  let parsed;
  try {
    parsed = new URL(serverUrl);
  } catch {
    console.error("CAPACITOR_SERVER_URL is not a valid URL.");
    process.exit(1);
  }
  if (parsed.username || parsed.password) {
    console.error("CAPACITOR_SERVER_URL must not include credentials.");
    process.exit(1);
  }
  if (parsed.protocol === "http:") {
    const allowed = !release && process.env.CAPACITOR_ALLOW_CLEARTEXT === "1" && loopbackHttp.test(serverUrl);
    if (!allowed) {
      console.error("CAPACITOR_SERVER_URL must use https://.");
      console.error(
        "Debug loopback HTTP is allowed only with CAPACITOR_ALLOW_CLEARTEXT=1, and release sync rejects it.",
      );
      process.exit(1);
    }
  } else if (parsed.protocol !== "https:") {
    console.error("CAPACITOR_SERVER_URL must be an https:// origin.");
    process.exit(1);
  }
} else if (release) {
  console.error("Set CAPACITOR_SERVER_URL to the public HTTPS origin before a release sync.");
  process.exit(1);
}

const serverJs = path.join(root, "capacitor-www", "server-url.js");
if (serverUrl && serverUrl.startsWith("https://")) {
  fs.writeFileSync(serverJs, `window.BUILDESK_SERVER_URL = ${JSON.stringify(serverUrl)};\n`, "utf8");
} else if (fs.existsSync(serverJs)) {
  fs.unlinkSync(serverJs);
}

const result = spawnSync("npx", ["cap", "sync", "android"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
