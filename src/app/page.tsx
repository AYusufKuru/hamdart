import { redirect } from "next/navigation";
import { getFirstAllowedPath } from "@/lib/auth/permissions";
import { getLiveSessionFromCookies } from "@/lib/auth/live-session";

export default async function Home() {
  let session = null;
  try {
    session = await getLiveSessionFromCookies();
  } catch {
    redirect("/login");
  }
  redirect(session ? getFirstAllowedPath(session.role) : "/login");
}
