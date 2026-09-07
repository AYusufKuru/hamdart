import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { getLiveSessionFromCookies } from "@/lib/auth/live-session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getLiveSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="hidden lg:block fixed h-full z-20">
        <Sidebar />
      </div>
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
