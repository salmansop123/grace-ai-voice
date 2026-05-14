"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/providers/toast-provider";
import { getApiErrorMessage } from "@/lib/api-error";
import { useCreateCheckout } from "@/lib/hooks/use-billing";

type UpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
};

const plans = [
  {
    key: "free",
    label: "Free",
    price: "$0/mo",
    features: ["100 minutes", "1 agent", "No campaigns"],
    cta: null,
  },
  {
    key: "starter",
    label: "Starter",
    price: "$49/mo",
    features: ["500 minutes", "3 agents", "5 campaigns"],
    cta: "starter",
    popular: true,
  },
  {
    key: "pro",
    label: "Pro",
    price: "$149/mo",
    features: ["2000 minutes", "10 agents", "20 campaigns"],
    cta: "pro",
  },
];

export function UpgradeModal({ open, onClose, title = "Upgrade to continue" }: UpgradeModalProps): JSX.Element | null {
  const checkoutMutation = useCreateCheckout();
  const { showToast } = useToast();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-5xl rounded-xl border border-border bg-bgSurface p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-textPrimary">{title}</h3>
            <p className="text-sm text-textSecondary">Choose a plan to unlock higher limits.</p>
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.key} className={plan.popular ? "border-accent" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{plan.label}</span>
                  {plan.popular ? <span className="rounded bg-accentDim px-2 py-0.5 text-xs">Most Popular</span> : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xl font-semibold">{plan.price}</p>
                <ul className="space-y-1 text-sm text-textSecondary">
                  {plan.features.map((feature) => (
                    <li key={feature}>- {feature}</li>
                  ))}
                </ul>
                {plan.cta ? (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={checkoutMutation.isPending}
                    onClick={async () => {
                      try {
                        const result = await checkoutMutation.mutateAsync(plan.cta);
                        if (result.url) {
                          window.location.href = result.url;
                        }
                      } catch (error) {
                        showToast(getApiErrorMessage(error, "Failed to start checkout"), "error");
                      }
                    }}
                  >
                    Upgrade to {plan.label}
                  </Button>
                ) : (
                  <Button type="button" className="w-full" variant="outline" disabled>
                    Current Baseline
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
