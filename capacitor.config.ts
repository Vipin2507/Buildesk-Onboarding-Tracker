import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android shell configuration.
 * The production URL is read at `cap sync` time from CAPACITOR_SERVER_URL.
 * Do not hardcode a private host here. Release sync rejects cleartext HTTP.
 */
declare const process: { env: Record<string, string | undefined> };

function serverUrlFromEnv(): string | undefined {
  const raw = process.env.CAPACITOR_SERVER_URL?.trim();
  if (!raw) return undefined;
  return raw.replace(/\/+$/, "");
}

const serverUrl = serverUrlFromEnv();
const loopbackHttp = /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/i.test(
  serverUrl ?? "",
);
const allowCleartext = process.env.CAPACITOR_ALLOW_CLEARTEXT === "1" && loopbackHttp;

if (serverUrl?.startsWith("http://") && !allowCleartext) {
  throw new Error(
    "CAPACITOR_SERVER_URL must be https://. Cleartext HTTP is only for a debug loopback host when CAPACITOR_ALLOW_CLEARTEXT=1.",
  );
}

const config: CapacitorConfig = {
  appId: "com.buildesk.compass",
  appName: "Buildesk Compass",
  webDir: "capacitor-www",
  android: {
    allowMixedContent: false,
    captureInput: true,
    appendUserAgent: "BuildeskCompassAndroid",
    backgroundColor: "#0B1F33",
    webContentsDebuggingEnabled: process.env.CAPACITOR_DEBUG_WEBVIEW === "1",
  },
  server: {
    androidScheme: "https",
    cleartext: allowCleartext,
    errorPath: "offline.html",
    allowNavigation: ["accounts.google.com", "*.google.com", "*.googleapis.com"],
    ...(serverUrl ? { url: serverUrl } : {}),
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0B1F33",
      showSpinner: false,
      androidScaleType: "CENTER_INSIDE",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0B1F33",
      overlaysWebView: false,
    },
    SystemBars: {
      insetsHandling: "native",
      initialViewportFitValueHint: "cover",
      style: "DARK",
    },
  },
};

export default config;
