import { NextResponse, type NextRequest } from "next/server";
import { normalizeGrants } from "@/lib/auth/permissions";
import { toAuthUser } from "@/lib/auth/user";
import { authenticateLogin } from "@/lib/auth/login-guard";
import {
  applyCookie,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { applyCsrfCookie, createCsrfToken } from "@/lib/auth/csrf";
import {
  formatApiError,
  getIpFromRequest,
  jsonError,
  parseBody,
} from "@/lib/server/api-utils";
import { loginBodySchema } from "@/lib/server/schemas";

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseBody(req, loginBodySchema);
    if (!parsed.ok) return parsed.response;

    const username = parsed.data.username.toLowerCase();
    const password = parsed.data.password;

    const result = await authenticateLogin(
      username,
      password,
      getIpFromRequest(req)
    );

    if ("denied" in result) {
      const headers: Record<string, string> = {};
      if (result.denied.retryAfterSec) {
        headers["Retry-After"] = String(result.denied.retryAfterSec);
      }
      return jsonError(result.denied.message, result.denied.status, {
        headers,
      });
    }

    const user = result.user;
    const grants = normalizeGrants(user.roleGrants, user.role);
    if (grants.length === 0) {
      return jsonError(
        "Hesap rolü geçersiz. Sistem yöneticisine başvurun.",
        403
      );
    }

    const session = {
      userId: user.id,
      username: user.username,
      name: user.name,
      role: grants[0].role,
      grants,
      mustChangePassword: user.mustChangePassword,
      tokenVersion: user.tokenVersion,
    };
    const token = await createSessionToken(session);

    const response = NextResponse.json({ user: toAuthUser(session) });
    applyCookie(response, sessionCookieOptions(token));
    applyCsrfCookie(response, createCsrfToken());
    return response;
  } catch (e) {
    return jsonError(formatApiError(e, "Giriş başarısız"), 500);
  }
}
