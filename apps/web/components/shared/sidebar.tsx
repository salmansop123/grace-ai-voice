"use client";

import Image from "next/image";
import { useClerk } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { SyncStatus } from "@/components/shared/sync-status";
import { CLERK_ENABLED } from "@/lib/clerk-config";
import { cn } from "@/lib/utils";

const links: Array<{ href: Route; label: string }> = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/schedule", label: "Schedule" },
  { href: "/dashboard/jobs", label: "Jobs" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/agent", label: "Agent" },
  { href: "/dashboard/calls", label: "Calls" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/settings", label: "Settings" },
];

function clearGraceLocalState(): void {
  try {
    window.localStorage.removeItem("grace-local-customers");
    window.localStorage.removeItem("grace-local-schedule-jobs");
    window.localStorage.removeItem("grace_ai_sync_queue");
  } catch {
    /* ignore */
  }
}

function SidebarClerkLogoutButton(): JSX.Element {
  const { signOut } = useClerk();
  const buttonClass =
    "w-full rounded-md border border-[#8ec5ff] bg-white px-3 py-2 text-sm font-medium text-[#0b3f86] transition-colors hover:bg-[#ecf5ff] dark:border-border dark:bg-bgBase dark:text-textPrimary dark:hover:bg-bgElevated";

  return (
    <button
      type="button"
      className={buttonClass}
      onClick={() => {
        clearGraceLocalState();
        const redirectUrl =
          typeof window !== "undefined" ? `${window.location.origin}/` : "/";
        void signOut({ redirectUrl });
      }}
    >
      Logout
    </button>
  );
}

export function Sidebar(): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <>
      <button
        type="button"
        className="fixed left-3 top-3 z-[60] flex h-11 w-11 items-center justify-center rounded-lg border border-[#8ec5ff] bg-[#dcebff] text-[#0b3f86] shadow-md lg:hidden dark:border-border dark:bg-bgSurface dark:text-textPrimary"
        aria-expanded={mobileOpen}
        aria-controls="dashboard-sidebar-nav"
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setMobileOpen((o) => !o)}
      >
        {mobileOpen ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
      </button>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        id="dashboard-sidebar-nav"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(100%,280px)] flex-col border-r border-[#b7d8ff] bg-[#dcebff] p-4 transition-transform duration-200 ease-out dark:border-border dark:bg-bgSurface",
          "lg:static lg:z-0 lg:w-64 lg:translate-x-0 lg:shadow-none",
          mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="mb-6 flex items-start justify-between gap-2">
          <Link href={"/dashboard" as Route} className="inline-block max-w-full min-w-0" onClick={() => setMobileOpen(false)}>
            <Image
              src="/logo.svg"
              alt="Grace AI logo"
              width={640}
              height={180}
              sizes="176px"
              priority
              className="block h-10 w-auto max-h-10 max-w-[176px] object-contain object-left"
            />
          </Link>
          <button
            type="button"
            className="rounded-md p-2 text-[#0b3f86] hover:bg-[#bfdcff] lg:hidden dark:text-textPrimary dark:hover:bg-accentDim"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm text-[#2256a1] transition-colors hover:bg-[#bfdcff] hover:text-[#123f7f] dark:text-textSecondary dark:hover:bg-accentDim dark:hover:text-textPrimary",
                pathname === link.href && "bg-[#8ec5ff] text-[#0b3f86] dark:bg-accentDim dark:text-textPrimary"
              )}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 shrink-0">
          <SyncStatus />
        </div>
        <div className="mt-3 shrink-0">
          {CLERK_ENABLED ? (
            <SidebarClerkLogoutButton />
          ) : (
            <button
              type="button"
              className="w-full rounded-md border border-[#8ec5ff] bg-white px-3 py-2 text-sm font-medium text-[#0b3f86] transition-colors hover:bg-[#ecf5ff] dark:border-border dark:bg-bgBase dark:text-textPrimary dark:hover:bg-bgElevated"
              onClick={() => {
                try {
                  document.cookie = "grace_dev_auth=; path=/; max-age=0; samesite=lax";
                  document.cookie = "grace_dev_user=; path=/; max-age=0; samesite=lax";
                } catch {}
                clearGraceLocalState();
                router.push("/" as Route);
              }}
            >
              Logout
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
