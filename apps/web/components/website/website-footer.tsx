import Link from "next/link";
import type { Route } from "next";

export function WebsiteFooter(): JSX.Element {
  return (
    <footer className="border-t border-sky-100/85 bg-gradient-to-b from-white to-slate-50/40">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-900">Grace AI</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
              The AI voice operating system for business communications agents, telephony, campaigns, and intelligence in
              one platform.
            </p>
          </div>
          <div className="flex flex-wrap gap-12 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Product</p>
              <ul className="mt-4 space-y-2.5 text-slate-600">
                <li>
                  <Link href={"/#what-is-grace" as Route} className="transition-colors hover:text-blue-600">
                    Platform
                  </Link>
                </li>
                <li>
                  <Link href={"/#platform-modules" as Route} className="transition-colors hover:text-blue-600">
                    Modules
                  </Link>
                </li>
                <li>
                  <Link href={"/#experience" as Route} className="transition-colors hover:text-violet-600">
                    Experience
                  </Link>
                </li>
                <li>
                  <Link href={"/sign-in" as Route} className="transition-colors hover:text-cyan-700">
                    Dashboard
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Company</p>
              <ul className="mt-4 space-y-2.5 text-slate-600">
                <li>
                  <Link href={"/contact" as Route} className="transition-colors hover:text-violet-600">
                    Contact
                  </Link>
                </li>
                <li>
                  <a href="#" className="transition-colors hover:text-blue-600">
                    Privacy (coming soon)
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-12 border-t border-sky-100/80 pt-8 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Grace AI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
