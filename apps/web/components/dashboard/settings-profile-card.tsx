"use client";

import { UserProfile } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/providers/toast-provider";
import { CLERK_ENABLED } from "@/lib/clerk-config";

function readDevEmailFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )grace_dev_user=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function DevPasswordForm(): JSX.Element {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setEmail(readDevEmailFromCookie() ?? "");
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!email.trim()) {
      showToast("Could not read your signed-in email. Sign in again.", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("New password must be at least 6 characters.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("New password and confirmation do not match.", "error");
      return;
    }
    if (newPassword === currentPassword) {
      showToast("Choose a different password than your current one.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/auth/dev/change-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            current_password: currentPassword,
            new_password: newPassword,
          }),
        }
      );
      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) {
        showToast(typeof data.detail === "string" ? data.detail : "Could not update password", "error");
        return;
      }
      showToast("Password updated successfully.", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:bg-bgElevated dark:text-textPrimary dark:placeholder:text-textSecondary";

  return (
    <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
      <p className="text-sm text-textSecondary">
        Your credentials are stored in the local dev database (<code className="text-xs text-textPrimary">dev_auth_users</code>).
        Updating your password here updates that record only.
      </p>
      <div className="space-y-1">
        <label className="text-xs font-medium text-textSecondary">Email</label>
        <input type="email" readOnly disabled className={`${inputClass} opacity-80`} value={email} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-textSecondary">Current password</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-textSecondary">New password</label>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputClass}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-textSecondary">Confirm new password</label>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputClass}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={isSubmitting || !email}>
        {isSubmitting ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}

function ClerkProfilePanel(): JSX.Element {
  return (
    <div className="space-y-3">
      <p className="text-sm text-textSecondary">
        Account email, password, and security settings are managed by Clerk and stored in your Clerk project (not in this
        app&apos;s PostgreSQL database). Use Security below to change your password.
      </p>
      <div className="max-h-[min(70vh,640px)] overflow-y-auto rounded-md border border-border bg-bgElevated">
        {/* virtual routing keeps navigation inside this mount (no extra app routes). */}
        <UserProfile
          routing="virtual"
          appearance={{ variables: { fontSize: "14px" } }}
          __experimental_startPath="security"
        />
      </div>
    </div>
  );
}

export function SettingsProfileCard(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>{CLERK_ENABLED ? <ClerkProfilePanel /> : <DevPasswordForm />}</CardContent>
    </Card>
  );
}
