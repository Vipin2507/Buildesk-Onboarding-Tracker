import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ThemeToggleCompact } from "@/components/theme-toggle";
import { authLogin } from "@/server/api/auth";
import { homePathForUser } from "@/lib/product-scope";
import { useAuthStore } from "@/stores";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    // Keep mode for backward-compatible links; register is no longer offered publicly.
    mode: (search.mode === "register" ? "register" : "login") as "login" | "register",
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate({ from: "/login" });
  const setUser = useAuthStore((s) => s.setUser);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  function onLogin() {
    void loginForm.handleSubmit(async (data) => {
      setBusy(true);
      try {
        const result = await authLogin({ data });
        if (result.success) {
          setUser(result.data.user);
          toast.success("Welcome back!");
          void navigate({ to: homePathForUser(result.data.user) });
        } else {
          toast.error(result.error);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Login failed");
      } finally {
        setBusy(false);
      }
    })();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 px-4 py-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:py-10">
      <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] sm:right-6">
        <ThemeToggleCompact />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_24px_rgb(0_155_255_/_0.25)]">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Buildesk Compass</h1>
          <p className="mt-1 text-sm text-muted-foreground">ERP Tracker & CRM Onboarding</p>
        </div>

        <div className="card-soft overflow-hidden p-6">
          <h2 className="mb-1 text-lg font-semibold">Sign in</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Enter your work email and password to continue.
          </p>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              onLogin();
            }}
          >
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="you@company.com"
                aria-invalid={loginForm.formState.errors.email ? true : undefined}
                className="mt-1 min-h-12 w-full rounded-md border px-3 text-base"
                {...loginForm.register("email")}
              />
              {loginForm.formState.errors.email ? (
                <p className="mt-1 text-sm text-destructive">
                  {loginForm.formState.errors.email.message}
                </p>
              ) : null}
            </label>
            <label className="block text-sm font-medium">
              Password
              <div className="relative mt-1">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  placeholder="••••••••"
                  aria-invalid={loginForm.formState.errors.password ? true : undefined}
                  className="min-h-12 w-full rounded-md border px-3 pr-12 text-base"
                  {...loginForm.register("password")}
                />
                <button
                  type="button"
                  className="absolute right-1 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowLoginPassword((v) => !v)}
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                >
                  {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {loginForm.formState.errors.password ? (
                <p className="mt-1 text-sm text-destructive">
                  {loginForm.formState.errors.password.message}
                </p>
              ) : null}
            </label>
            <Button className="min-h-12 w-full text-base" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
