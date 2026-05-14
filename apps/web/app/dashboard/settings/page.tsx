"use client";

import { useEffect, useState } from "react";

import { SettingsProfileCard } from "@/components/dashboard/settings-profile-card";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { getApiErrorMessage } from "@/lib/api-error";
import { CLERK_ENABLED } from "@/lib/clerk-config";
import { useBillingInvoices, useBillingUsage, useCreateBillingPortal } from "@/lib/hooks/use-billing";
import { useOrgRoleWithClerk } from "@/lib/hooks/use-org-role-clerk";
import { useSystemStatus } from "@/lib/hooks/use-system-status";

function SettingsPageInner({ isAdmin }: { isAdmin: boolean }): JSX.Element {
  const [mounted, setMounted] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const statusQuery = useSystemStatus();
  const billingUsageQuery = useBillingUsage();
  const invoicesQuery = useBillingInvoices();
  const portalMutation = useCreateBillingPortal();
  const { showToast } = useToast();
  const { mode, resolvedTheme, setMode } = useTheme();
  const data = statusQuery.data;
  const billing = billingUsageQuery.data;
  const isPayingPlan = (billing?.plan ?? "free").toLowerCase() !== "free";
  const stripeConfigured = statusQuery.isSuccess && (data?.integrations.stripe_connected ?? false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handlePortal(): Promise<void> {
    try {
      const result = await portalMutation.mutateAsync();
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to open billing portal"), "error");
    }
  }

  return (
    <div className="space-y-6">
      <UpgradeModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} title="Upgrade your Grace AI plan" />
      <div>
        <h1 className="text-2xl font-semibold text-textPrimary">Settings & Operations</h1>
        <p className="text-sm text-textSecondary">Environment connectivity and tenancy overview.</p>
      </div>

      <SettingsProfileCard />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-textSecondary">
              Theme follows your laptop preference when set to system.
            </p>
            <p className="mt-1 text-xs text-textSecondary">
              Current resolved theme:{" "}
              <span className="font-medium text-textPrimary" suppressHydrationWarning>
                {mounted ? resolvedTheme : "system"}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={mode === "light" ? "default" : "outline"} onClick={() => setMode("light")}>
              Light
            </Button>
            <Button type="button" variant={mode === "dark" ? "default" : "outline"} onClick={() => setMode("dark")}>
              Dark
            </Button>
            <Button type="button" variant={mode === "system" ? "default" : "outline"} onClick={() => setMode("system")}>
              System
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {statusQuery.isLoading ? <p className="text-textSecondary">Loading status...</p> : null}
          {statusQuery.isError ? (
            <p className="text-[color:var(--danger)]">Could not fetch system status from backend.</p>
          ) : null}
          {data ? (
            <>
              <p>
                <span className="text-textSecondary">Org:</span> {data.org_name} ({data.org_id})
              </p>
              <p>
                <span className="text-textSecondary">Plan:</span> {data.plan}
              </p>
              <p>
                <span className="text-textSecondary">Usage:</span> {data.minutes_used}/{data.minutes_limit} minutes
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-bgElevated p-3">
            <p className="text-sm font-medium">Current plan: {billing?.plan?.toUpperCase() ?? "FREE"}</p>
            <p className="text-xs text-textSecondary">
              Usage: {billing?.minutes_used ?? 0}/{billing?.minutes_limit ?? 100} minutes
            </p>
            <div className="mt-2 h-2 rounded-full bg-bgBase">
              <div
                className="h-2 rounded-full bg-accent"
                style={{ width: `${Math.min(100, billing?.percent ?? 0)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-textSecondary">{billing?.percent ?? 0}% used</p>
            {(billing?.percent ?? 0) > 90 ? (
              <p className="mt-1 text-xs text-[color:var(--warning)]">
                Warning: usage is above 90% of your monthly minutes.
              </p>
            ) : null}
            {billing?.renewal_date ? (
              <p className="mt-1 text-xs text-textSecondary">
                Renewal: {new Date(billing.renewal_date).toLocaleDateString()}
              </p>
            ) : null}
            <div className="mt-3 grid gap-2 text-xs text-textSecondary md:grid-cols-3">
              <p>
                Agents: <span className="font-medium text-textPrimary">{billing?.agents_count ?? 0}</span> /{" "}
                {billing?.limits.agents ?? 0}
              </p>
              <p>
                Campaigns: <span className="font-medium text-textPrimary">{billing?.campaigns_count ?? 0}</span> /{" "}
                {billing?.limits.campaigns ?? 0}
              </p>
              <p>
                KB Docs: <span className="font-medium text-textPrimary">{billing?.kb_docs_count ?? 0}</span> /{" "}
                {billing?.limits.kb_docs ?? 0}
              </p>
            </div>
          </div>
          {data && statusQuery.isSuccess && !stripeConfigured ? (
            <p className="rounded-md border border-border bg-bgElevated px-3 py-2 text-xs text-textSecondary">
              Stripe API keys are missing or invalid on the server (see Integrations → Stripe). Upgrade and billing
              portal may still be tried; if they fail, configure <code className="rounded bg-bgBase px-1">STRIPE_SECRET_KEY</code>{" "}
              and price IDs in the API environment and enable the Customer billing portal in Stripe.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {!isPayingPlan ? (
              <Button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                disabled={!isAdmin}
                title={!isAdmin ? "Admin only" : undefined}
              >
                Upgrade Plan
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => void handlePortal()}
              disabled={portalMutation.isPending || !isAdmin}
              title={
                !isAdmin
                  ? "Admin only"
                  : "Open Stripe billing portal to update payment method and subscription"
              }
            >
              {portalMutation.isPending ? "Opening…" : "Manage Billing"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
        </CardHeader>
        <CardContent>
          {invoicesQuery.isLoading ? <p className="text-sm text-textSecondary">Loading invoices...</p> : null}
          {invoicesQuery.isError ? (
            <p className="text-sm text-[color:var(--danger)]">Failed to load invoice history.</p>
          ) : null}
          {!invoicesQuery.isLoading && (invoicesQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-textSecondary">No invoices available yet.</p>
          ) : null}
          {(invoicesQuery.data?.length ?? 0) > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-textSecondary">
                  <tr className="border-b border-border">
                    <th className="py-2 font-medium">Date</th>
                    <th className="py-2 font-medium">Amount</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesQuery.data?.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-border/60">
                      <td className="py-3">{new Date(invoice.date * 1000).toLocaleDateString()}</td>
                      <td className="py-3">${invoice.amount.toFixed(2)}</td>
                      <td className="py-3">{invoice.status}</td>
                      <td className="py-3">
                        {invoice.pdf_url ? (
                          <a href={invoice.pdf_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                            Download PDF
                          </a>
                        ) : (
                          "--"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            { label: "Twilio", ok: data?.integrations.twilio_connected ?? false },
            { label: "Redis", ok: data?.integrations.redis_connected ?? false },
            { label: "Stripe", ok: data?.integrations.stripe_connected ?? false }
          ].map((item) => (
            <div key={item.label} className="rounded-md border border-border bg-bgElevated p-3">
              <p className="text-sm font-medium">{item.label}</p>
              <p className={`text-xs ${item.ok ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"}`}>
                {item.ok ? "connected" : "not connected"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsWithClerk(): JSX.Element {
  const { isAdmin } = useOrgRoleWithClerk();
  return <SettingsPageInner isAdmin={isAdmin} />;
}

export default function SettingsPage(): JSX.Element {
  if (!CLERK_ENABLED) {
    return <SettingsPageInner isAdmin={true} />;
  }
  return <SettingsWithClerk />;
}
