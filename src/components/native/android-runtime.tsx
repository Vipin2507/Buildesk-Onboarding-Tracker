import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { authMe } from "@/server/api/auth";
import {
  androidApkReady,
  isAndroidUpgradeAvailable,
  loadAndroidRelease,
  openAndroidApk,
} from "@/lib/native/android-release";
import { safeInAppPath } from "@/lib/native/deep-link";
import {
  getMobileNavOpen,
  registerNativeConnectivityRecheck,
  setKeyboardOpen,
  setMobileNavOpen,
  setNativeOffline,
} from "@/lib/native/shell-state";
import { useAuthStore } from "@/stores";

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
};

const ROOT_PATHS = new Set(["/", "/crm", "/login"]);

function isRootPath(pathname: string) {
  return ROOT_PATHS.has(pathname);
}

function dismissOpenLayer() {
  if (getMobileNavOpen()) {
    setMobileNavOpen(false);
    return true;
  }
  const open = document.querySelector(
    '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"]',
  );
  if (!open) return false;
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
      cancelable: true,
    }),
  );
  return true;
}

function isGoogleSignInHost(hostname: string) {
  return (
    hostname === "accounts.google.com" ||
    hostname === "accounts.google.co.in" ||
    hostname.endsWith(".googleapis.com")
  );
}

function openInApp(raw: string) {
  const path = safeInAppPath(raw, window.location.origin);
  if (!path) {
    toast.error("That link can’t be opened inside Buildesk Compass.");
    return;
  }
  const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (path === here) return;
  window.location.assign(new URL(path, window.location.origin).href);
}

export function AndroidRuntime() {
  const [exitOpen, setExitOpen] = useState(false);
  const [requiredUpdate, setRequiredUpdate] = useState<string | null>(null);
  const [softUpdate, setSoftUpdate] = useState<string | null>(null);
  const [apkUrl, setApkUrl] = useState<string | null>(null);
  const exitApp = useRef<() => Promise<void>>(async () => {});
  const seenLinks = useRef(new Set<string>());

  useEffect(() => {
    const capacitor = (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor;
    if (!capacitor?.isNativePlatform?.()) return;

    let cancelled = false;
    const removals: Array<() => void> = [];

    void (async () => {
      const [
        { App },
        { StatusBar, Style },
        { Keyboard, KeyboardResize },
        { Network },
        { Browser },
        { SplashScreen },
      ] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/status-bar"),
        import("@capacitor/keyboard"),
        import("@capacitor/network"),
        import("@capacitor/browser"),
        import("@capacitor/splash-screen"),
      ]);
      if (cancelled) return;

      exitApp.current = () => App.exitApp();

      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setBackgroundColor({ color: "#0B1F33" });
        await StatusBar.setStyle({ style: Style.Dark });
      } catch {
        /* Status bar plugin can reject before the activity is ready. */
      }
      void SplashScreen.hide().catch(() => undefined);
      void Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => undefined);

      const syncNetwork = async () => {
        const status = await Network.getStatus();
        setNativeOffline(!status.connected);
      };
      await syncNetwork();
      const networkHandle = await Network.addListener("networkStatusChange", (status) => {
        setNativeOffline(!status.connected);
      });
      removals.push(() => void networkHandle.remove());
      removals.push(registerNativeConnectivityRecheck(syncNetwork));

      const showHandle = await Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
      const hideHandle = await Keyboard.addListener("keyboardDidHide", () =>
        setKeyboardOpen(false),
      );
      removals.push(() => void showHandle.remove());
      removals.push(() => void hideHandle.remove());

      const backHandle = await App.addListener("backButton", ({ canGoBack }) => {
        if (dismissOpenLayer()) return;
        if (!isRootPath(window.location.pathname) && canGoBack) {
          window.history.back();
          return;
        }
        setExitOpen(true);
      });
      removals.push(() => void backHandle.remove());

      const resumeHandle = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) return;
        const before = useAuthStore.getState().user;
        void (async () => {
          try {
            const result = await authMe();
            if (cancelled) return;
            if (!result.user && before) {
              useAuthStore.getState().setUser(null);
              toast.error("Your session expired. Sign in again. Unsent changes were not saved.");
              return;
            }
            if (result.user) useAuthStore.getState().setUser(result.user);
          } catch {
            setNativeOffline(true);
          }
        })();
      });
      removals.push(() => void resumeHandle.remove());

      const handleLink = (url: string | undefined) => {
        if (!url || seenLinks.current.has(url)) return;
        seenLinks.current.add(url);
        openInApp(url);
      };
      const launch = await App.getLaunchUrl();
      handleLink(launch?.url);
      const urlHandle = await App.addListener("appUrlOpen", (event) => handleLink(event.url));
      removals.push(() => void urlHandle.remove());

      const onClick = (event: MouseEvent) => {
        const anchor = (event.target as Element | null)?.closest?.("a");
        if (!anchor) return;
        const href = anchor.getAttribute("href");
        if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:"))
          return;
        if (anchor.hasAttribute("download")) return;
        let url: URL;
        try {
          url = new URL(href, window.location.origin);
        } catch {
          return;
        }
        if (url.origin === window.location.origin || isGoogleSignInHost(url.hostname)) {
          if (anchor.target === "_blank") {
            event.preventDefault();
            window.location.assign(url.href);
          }
          return;
        }
        if (url.protocol !== "https:" && url.protocol !== "http:") return;
        event.preventDefault();
        void Browser.open({ url: url.href });
      };
      document.addEventListener("click", onClick, true);
      removals.push(() => document.removeEventListener("click", onClick, true));

      const originalOpen = window.open.bind(window);
      window.open = (url?: string | URL, target?: string, features?: string) => {
        if (url == null || url === "") return originalOpen(url, target, features);
        let resolved: URL;
        try {
          resolved = new URL(String(url), window.location.origin);
        } catch {
          return originalOpen(url, target, features);
        }
        if (resolved.origin === window.location.origin || isGoogleSignInHost(resolved.hostname)) {
          window.location.assign(resolved.href);
          return null;
        }
        if (resolved.protocol === "https:" || resolved.protocol === "http:") {
          void Browser.open({ url: resolved.href });
          return null;
        }
        return originalOpen(url, target, features);
      };
      removals.push(() => {
        window.open = originalOpen;
      });

      try {
        const release = await loadAndroidRelease();
        if (cancelled || !release) return;
        if (release.apkUrl && (await androidApkReady(release.apkUrl)) && !cancelled) {
          setApkUrl(release.apkUrl);
        }
        if (cancelled) return;
        const info = await App.getInfo();
        const minimum = release.minimumVersion;
        const latest = release.latestVersion;
        if (minimum && isAndroidUpgradeAvailable(info.version, minimum)) {
          setRequiredUpdate(
            release.message ||
              "Install the latest signed Android build before continuing. Android will ask you to confirm the install.",
          );
          return;
        }
        if (isAndroidUpgradeAvailable(info.version, latest)) {
          setSoftUpdate(
            `Android build ${latest} is ready. Upgrade app opens the signed APK. Android asks you to confirm the install. This screen can stay on ${info.version}.`,
          );
        }
      } catch {
        /* A missing release file must not block the app. */
      }
    })().catch(() => {
      /* Native plugins are absent in a normal browser. */
    });

    return () => {
      cancelled = true;
      setKeyboardOpen(false);
      removals.forEach((remove) => remove());
    };
  }, []);

  return (
    <>
      {softUpdate ? (
        <div
          role="status"
          className="border-b bg-secondary px-3 py-2 text-sm text-secondary-foreground"
        >
          <div className="mx-auto flex max-w-5xl items-start justify-between gap-3">
            <p>{softUpdate}</p>
            <div className="flex shrink-0 items-center gap-3">
              {apkUrl ? (
                <button
                  type="button"
                  className="inline-flex min-h-12 items-center font-semibold"
                  onClick={() => void openAndroidApk(apkUrl)}
                >
                  Upgrade app
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex min-h-12 items-center font-semibold"
                onClick={() => setSoftUpdate(null)}
              >
                Hide
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {requiredUpdate ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background px-4 py-[max(1.5rem,env(safe-area-inset-top))]">
          <div className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-[var(--shadow-elevated)]">
            <h1 className="text-xl font-semibold">Android update required</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{requiredUpdate}</p>
            {apkUrl ? (
              <button
                type="button"
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                onClick={() => void openAndroidApk(apkUrl)}
              >
                Upgrade app
              </button>
            ) : null}
            <button
              type="button"
              className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-xl border text-sm font-semibold"
              onClick={() => window.location.reload()}
            >
              Check again
            </button>
          </div>
        </div>
      ) : null}

      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Buildesk Compass?</AlertDialogTitle>
            <AlertDialogDescription>
              You’ll leave the app. Anything the server has not accepted yet is not saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-12">Stay</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-12"
              onClick={() => {
                void exitApp.current();
              }}
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
