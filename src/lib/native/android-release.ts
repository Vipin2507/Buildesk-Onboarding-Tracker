import { compareVersions } from "@/lib/native/deep-link";

export type AndroidRelease = {
  minimumVersion?: string;
  latestVersion?: string;
  message?: string;
  apkUrl?: string;
};

type ReleaseFile = {
  android?: {
    minimumVersion?: string;
    latestVersion?: string;
    message?: string;
    apkPath?: string;
  };
};

const APK_PATH = /^\/downloads\/[A-Za-z0-9][A-Za-z0-9._-]*\.apk$/;

export function androidApkUrl(apkPath: string | undefined, origin: string): string | undefined {
  if (!apkPath || !APK_PATH.test(apkPath) || apkPath.includes("..")) return undefined;
  let base: URL;
  try {
    base = new URL(origin);
  } catch {
    return undefined;
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") return undefined;
  if (base.username || base.password) return undefined;
  return new URL(apkPath, base.origin).href;
}

export async function loadAndroidRelease(origin = window.location.origin): Promise<AndroidRelease | null> {
  try {
    const response = await fetch("/native-release.json", { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as ReleaseFile;
    const android = body.android;
    if (!android) return null;
    return {
      minimumVersion: android.minimumVersion,
      latestVersion: android.latestVersion,
      message: android.message,
      apkUrl: androidApkUrl(android.apkPath, origin),
    };
  } catch {
    return null;
  }
}

export async function androidApkReady(url: string) {
  try {
    const head = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (head.ok) return true;
    return head.status === 405 || head.status === 501;
  } catch {
    return false;
  }
}

export function isAndroidUpgradeAvailable(installedVersion: string, latestVersion?: string) {
  if (!latestVersion) return false;
  return compareVersions(installedVersion, latestVersion) < 0;
}

/** Opens the signed APK. Android shows its own install confirmation. */
export async function openAndroidApk(url: string) {
  const native = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    ?.isNativePlatform?.();
  if (native) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
    return;
  }
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
