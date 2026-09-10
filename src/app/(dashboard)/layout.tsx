import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { AuthSessionSync } from "@/components/layout/auth-session-sync";
import { toAuthUser } from "@/lib/auth/user";
import { getLiveSessionFromCookies } from "@/lib/auth/live-session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session = null;
  try {
    session = await getLiveSessionFromCookies();
  } catch {
    redirect("/login");
  }
  if (!session) {
    redirect("/login");
  }
  const authUser = toAuthUser(session);

  return (
    <div className="flex h-dvh w-full min-w-0 overflow-hidden bg-background text-foreground">
      <AuthSessionSync user={authUser} />
      <div className="hidden lg:block fixed inset-y-0 left-0 z-20">
        <Sidebar />
      </div>
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden lg:pl-64">
        <Navbar />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden [&>*]:min-w-0 [&>*]:max-w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
