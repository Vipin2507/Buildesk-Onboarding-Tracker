import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
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
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const [showPassword, setShowPassword] = useState(false);
  const [tab, setTab] = useState<"login" | "register">(mode);

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
    navigate({ search: { mode: next }, replace: true });
  }

  function onLogin() {
    loginForm.handleSubmit((data) => {
      const result = login(data.email, data.password);
      if (result.success) {
        toast.success("Welcome back!");
        navigate({ to: "/" });
      } else {
        toast.error(result.error);
      }
    })();
  }

  function onRegister() {
    registerForm.handleSubmit((data) => {
      const result = register({
        name: data.name,
        email: data.email,
        password: data.password,
        role: "Viewer",
      });
      if (result.success) {
        toast.success("Account created — you're signed in!");
        navigate({ to: "/" });
      } else {
        toast.error(result.error);
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
              <Field label="Email" error={loginForm.formState.errors.email?.message}>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@buildesk.com"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                  {...loginForm.register("email")}
                />
              </Field>
              <Field label="Password" error={loginForm.formState.errors.password?.message}>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-10 w-full rounded-md border bg-background px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                    {...loginForm.register("password")}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
                Sign in
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
              <Field label="Full name" error={registerForm.formState.errors.name?.message}>
                <input
                  placeholder="Your name"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                  {...registerForm.register("name")}
                />
              </Field>
              <Field label="Email" error={registerForm.formState.errors.email?.message}>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@buildesk.com"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                  {...registerForm.register("email")}
                />
              </Field>
              <Field label="Password" error={registerForm.formState.errors.password?.message}>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                  {...registerForm.register("password")}
                />
              </Field>
              <Field label="Confirm password" error={registerForm.formState.errors.confirmPassword?.message}>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                  {...registerForm.register("confirmPassword")}
                />
              </Field>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
                Create account
              </Button>
            </form>
          )}

          <div className="mt-6 rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Demo accounts</p>
            <p className="mt-1">Password for all seed users: <code className="rounded bg-muted px-1">buildesk123</code></p>
            <ul className="mt-2 space-y-0.5">
              <li><button type="button" className="hover:underline" onClick={() => loginForm.setValue("email", "aditya@buildesk.com")}>aditya@buildesk.com</button> — Admin</li>
              <li><button type="button" className="hover:underline" onClick={() => loginForm.setValue("email", "priya@buildesk.com")}>priya@buildesk.com</button> — Manager</li>
            </ul>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Prototype auth — credentials stored locally in your browser.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
