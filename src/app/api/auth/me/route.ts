import { NextResponse, type NextRequest } from "next/server";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { getLiveSessionFromRequest } from "@/lib/auth/live-session";
import {
  applyCookie,
  clearSessionCookieOptions,
} from "@/lib/auth/session";
import { NO_STORE_HEADERS } from "@/lib/server/api-utils";

export async function GET(req: NextRequest) {
  const session = await getLiveSessionFromRequest(req);
  if (!session) {
    // Oturum yoksa 401 değil 200 + user:null. Bu uç "kimim?" sorusudur;
    // giriş sayfası her açılışta burayı çağırır, 401 tarayıcı konsolunda
    // hata gibi görünür.
    const response = NextResponse.json(
      { user: null },
      { status: 200, headers: NO_STORE_HEADERS }
    );
    applyCookie(response, clearSessionCookieOptions());
    return response;
  }
  return NextResponse.json(
    {
      user: {
        userId: session.userId,
        username: session.username,
        name: session.name,
        role: session.role,
        roleLabel: ROLE_LABELS[session.role] ?? session.role,
        mustChangePassword: session.mustChangePassword,
      },
    },
    { headers: NO_STORE_HEADERS }
  );
}
