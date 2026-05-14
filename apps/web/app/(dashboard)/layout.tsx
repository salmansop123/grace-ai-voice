import { Sidebar } from "@/components/shared/sidebar";
import { CLERK_ENABLED } from "@/lib/clerk-config";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children
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
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/auth/dev/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: decodeURIComponent(devUserEmail) }),
        cache: "no-store",
      });
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
    <div className="flex min-h-screen bg-bgBase">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
