"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WebsiteHeader(): JSX.Element {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLink = (href: Route, label: string): JSX.Element => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={cn(
          "rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-gradient-to-br hover:from-sky-50/90 hover:to-violet-50/50 hover:text-slate-900",
          active && "bg-gradient-to-br from-blue-50/95 to-cyan-50/40 text-blue-900 ring-1 ring-sky-200/90 shadow-[0_2px_10px_-6px_rgba(37,99,235,0.15)]"
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-sky-100/80 transition-[background-color,box-shadow,backdrop-filter] duration-300",
        scrolled
          ? "bg-white/90 shadow-[0_1px_0_rgba(37,99,235,0.06),0_14px_44px_-28px_rgba(37,99,235,0.1)] backdrop-blur-xl"
          : "bg-white/75 backdrop-blur-md"
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:h-[4.25rem] sm:px-6 lg:px-8">
        <Link href={"/" as Route} className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-85">
          <Image src="/logo.svg" alt="Grace AI" width={172} height={48} priority className="h-12 w-auto sm:h-16" />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLink("/" as Route, "Home")}
          {navLink("/contact" as Route, "Contact Us")}

          <Button
            asChild
            size="sm"
            className="ml-3 rounded-full border-0 bg-gradient-to-r from-[#2563eb] via-[#0891b2] to-[#14b8a6] px-6 font-semibold text-white shadow-[0_3px_14px_-4px_rgba(37,99,235,0.35)] transition-[transform,box-shadow] hover:translate-y-[-1px] hover:shadow-[0_8px_22px_-6px_rgba(37,99,235,0.28)] active:translate-y-0"
          >
            <Link href={"/sign-in" as Route}>Sign In</Link>
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Button
            asChild
            size="sm"
            className="rounded-full border-0 bg-gradient-to-r from-[#2563eb] via-[#0891b2] to-[#14b8a6] px-4 font-semibold text-white shadow-[0_3px_14px_-4px_rgba(37,99,235,0.32)]"
          >
            <Link href={"/sign-in" as Route}>Sign In</Link>
          </Button>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "border-t border-sky-100/85 bg-white/95 shadow-inner backdrop-blur-xl md:hidden",
          mobileOpen ? "block" : "hidden"
        )}
      >
        <nav className="flex flex-col gap-1 px-4 py-3 pb-4">
          <Link
            href={"/" as Route}
            className={cn(
              "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-blue-50/80",
              pathname === "/" ? "font-semibold text-blue-700" : "text-slate-800"
            )}
            onClick={() => setMobileOpen(false)}
          >
            Home
          </Link>
          <Link
            href={"/#pricing" as Route}
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-cyan-50/90"
            onClick={() => setMobileOpen(false)}
          >
            Pricing
          </Link>
          <Link
            href={"/contact" as Route}
            className={cn(
              "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-violet-50/80",
              pathname === "/contact" ? "font-semibold text-violet-700" : "text-slate-800"
            )}
            onClick={() => setMobileOpen(false)}
          >
            Contact Us
          </Link>
        </nav>
      </div>
    </header>
  );
}
