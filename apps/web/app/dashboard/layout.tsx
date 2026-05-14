import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/shared/sidebar";
import { CLERK_ENABLED } from "@/lib/clerk-config";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  if (!CLERK_ENABLED) {
    const cookieStore = cookies();
    const hasDevSession = cookieStore.get("grace_dev_auth")?.value === "1";
    const devUserEmail = cookieStore.get("grace_dev_user")?.value;
    if (!hasDevSession) {
      redirect("/sign-in");
    }
    if (!devUserEmail) {
      redirect("/sign-in");
    }

    try {
      const verifyResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/auth/dev/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: decodeURIComponent(devUserEmail) }),
          cache: "no-store",
        }
      );
      const verifyJson = (await verifyResponse.json()) as { exists?: boolean };
      if (!verifyResponse.ok || !verifyJson.exists) {
        redirect("/sign-in");
      }
    } catch {
      redirect("/sign-in");
    }
  }

  if (CLERK_ENABLED) {
    const clerkModule = await import("@clerk/nextjs/server");
    const { userId } = clerkModule.auth();
    if (!userId) {
      redirect("/sign-in");
    }
  }

  return (
    <div className="flex min-h-screen min-w-0 bg-bgBase">
      <Sidebar />
      <main className="min-h-screen min-w-0 w-full max-w-full flex-1 overflow-x-auto bg-bgBase px-4 pb-6 pt-14 sm:px-6 sm:pb-6 sm:pt-16 lg:px-6 lg:pt-6">
        {children}
      </main>
    </div>
  );
}
