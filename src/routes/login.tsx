import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authLogin, authRegister } from "@/lib/api";
import { useAuthStore } from "@/stores";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: (search.mode === "register" ? "register" : "login") as "login" | "register",
  }),
  component: LoginPage,
});

function LoginPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate({ from: "/login" });
  const setUser = useAuthStore((s) => s.setUser);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [tab, setTab] = useState<"login" | "register">(mode);
  const [busy, setBusy] = useState(false);

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  function switchTab(next: "login" | "register") {
    setTab(next);
    void navigate({ search: { mode: next }, replace: true });
  }

  function onLogin() {
    void loginForm.handleSubmit(async (data) => {
      setBusy(true);
      try {
        const result = await authLogin({ data });
        if (result.success) {
          setUser(result.data.user);
          toast.success("Welcome back!");
          void navigate({ to: "/" });
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

  function onRegister() {
    void registerForm.handleSubmit(async (data) => {
      setBusy(true);
      try {
        const result = await authRegister({
          data: {
            name: data.name,
            email: data.email,
            password: data.password,
            role: "Viewer",
          },
        });
        if (result.success) {
          setUser(result.data.user);
          toast.success("Account created — you're signed in!");
          void navigate({ to: "/" });
        } else {
          toast.error(result.error);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Registration failed");
      } finally {
        setBusy(false);
      }
    })();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Buildesk</h1>
          <p className="mt-1 text-sm text-muted-foreground">Onboarding & Post-Sales Tracker</p>
        </div>

        <div className="card-soft overflow-hidden p-6">
          <div className="mb-6 flex rounded-lg border bg-muted/40 p-1">
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => switchTab(t)}
                className={cn(
                  "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
                  tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "login" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>

          {tab === "login" ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                onLogin();
              }}
            >
              <label className="block text-xs font-medium">
                Email
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                  {...loginForm.register("email")}
                />
              </label>
              <label className="block text-xs font-medium">
                Password
                <div className="relative mt-1">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-10 w-full rounded-md border px-3 pr-10 text-sm"
                    {...loginForm.register("password")}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <Button className="w-full" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                onRegister();
              }}
            >
              <label className="block text-xs font-medium">
                Name
                <input
                  autoComplete="name"
                  className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                  {...registerForm.register("name")}
                />
              </label>
              <label className="block text-xs font-medium">
                Email
                <input
                  type="email"
                  autoComplete="email"
                  className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                  {...registerForm.register("email")}
                />
              </label>
              <label className="block text-xs font-medium">
                Password
                <div className="relative mt-1">
                  <input
                    type={showRegPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="h-10 w-full rounded-md border px-3 pr-10 text-sm"
                    {...registerForm.register("password")}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowRegPassword((v) => !v)}
                    aria-label={showRegPassword ? "Hide password" : "Show password"}
                  >
                    {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <label className="block text-xs font-medium">
                Confirm password
                <div className="relative mt-1">
                  <input
                    type={showRegConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    className="h-10 w-full rounded-md border px-3 pr-10 text-sm"
                    {...registerForm.register("confirmPassword")}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowRegConfirm((v) => !v)}
                    aria-label={showRegConfirm ? "Hide password" : "Show password"}
                  >
                    {showRegConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <Button className="w-full" disabled={busy}>
                {busy ? "Creating…" : "Create account"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
