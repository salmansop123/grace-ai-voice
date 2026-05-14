"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CLERK_ENABLED } from "@/lib/clerk-config";

export default function SignUpPage(): JSX.Element {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleDevSignUp(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Name, email and password are required");
      return;
    }
    try {
      setIsSubmitting(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/auth/dev/sign-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) {
        setError(data.detail ?? "Could not create account");
        return;
      }
      document.cookie = "grace_dev_auth=1; path=/; max-age=2592000; samesite=lax";
      document.cookie = `grace_dev_user=${encodeURIComponent(email.trim().toLowerCase())}; path=/; max-age=2592000; samesite=lax`;
      router.push("/dashboard");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDevGoogleSignUp(): void {
    setError("Google sign-up is disabled in dev auth mode. Use email/password.");
  }

  if (!CLERK_ENABLED) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bgBase p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-bgSurface p-6 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-textPrimary">Create your account</h1>
            <p className="mt-1 text-sm text-textSecondary">Get started with Grace AI in seconds</p>
          </div>
          <form className="space-y-3" onSubmit={handleDevSignUp}>
            <button
              type="button"
              onClick={handleDevGoogleSignUp}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-bgBase px-4 py-2.5 text-sm font-medium text-textPrimary hover:bg-bgElevated"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[#4285F4]">
                G
              </span>
              Continue with Google
            </button>
            <div className="relative py-1">
              <div className="h-px w-full bg-border" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-bgSurface px-2 text-xs text-textSecondary">
                or
              </span>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-textSecondary">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:bg-bgElevated dark:text-textPrimary dark:placeholder:text-textSecondary"
                placeholder="Grace Admin"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-textSecondary">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:bg-bgElevated dark:text-textPrimary dark:placeholder:text-textSecondary"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-textSecondary">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:bg-bgElevated dark:text-textPrimary dark:placeholder:text-textSecondary"
                placeholder="Create password"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
            {error ? <p className="text-xs text-[color:var(--danger)]">{error}</p> : null}
          </form>
          <p className="mt-4 text-center text-sm text-textSecondary">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bgBase">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/dashboard"
        fallbackRedirectUrl="/dashboard"
      />
    </main>
  );
}
