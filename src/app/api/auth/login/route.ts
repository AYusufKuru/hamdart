import { NextResponse, type NextRequest } from "next/server";
import { ROLES, type Role } from "@/lib/auth/permissions";
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
    if (!ROLES.includes(user.role as Role)) {
      return jsonError("Kullanıcı rolü geçersiz", 500);
    }

    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role as Role,
      mustChangePassword: user.mustChangePassword,
      tokenVersion: user.tokenVersion,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
    applyCookie(response, sessionCookieOptions(token));
    applyCsrfCookie(response, createCsrfToken());
    return response;
  } catch (e) {
    return jsonError(formatApiError(e, "Giriş başarısız"), 500);
  }
}
