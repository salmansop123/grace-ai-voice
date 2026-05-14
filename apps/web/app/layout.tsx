import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { CLERK_ENABLED } from "@/lib/clerk-config";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grace AI",
  description: "AI Voice Calling Platform"
};

const themeBootScript = `
(() => {
  try {
    const key = "grace-theme-mode";
    const stored = localStorage.getItem(key);
    const mode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    const resolved = mode === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : mode;
    document.documentElement.classList.toggle("dark", resolved === "dark");
  } catch {}
})();
`;

export default async function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const appTree = (
    <ThemeProvider>
      <QueryProvider>
        <ToastProvider>{children}</ToastProvider>
      </QueryProvider>
    </ThemeProvider>
  );

  let wrappedTree = appTree;
  if (CLERK_ENABLED) {
    const clerkModule = await import("@clerk/nextjs");
    const ClerkProvider = clerkModule.ClerkProvider;
    const appBase = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
    const afterSignOutUrl = appBase ? `${appBase}/` : "/";
    wrappedTree = <ClerkProvider afterSignOutUrl={afterSignOutUrl}>{appTree}</ClerkProvider>;
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${GeistSans.className} ${GeistMono.variable}`}>
        {wrappedTree}
      </body>
    </html>
  );
}
