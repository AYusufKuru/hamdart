import { redirect } from "next/navigation";
import { getLiveSessionFromCookies } from "@/lib/auth/live-session";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const session = await getLiveSessionFromCookies();
  if (!session) {
    redirect("/login?next=%2Fchange-password");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50 p-6">
      <ChangePasswordForm
        forced={session.mustChangePassword}
        username={session.username}
        name={session.name}
      />
    </div>
  );
}
