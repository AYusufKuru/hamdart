import { NextResponse, type NextRequest } from "next/server";
import {
  applyCookie,
  clearSessionCookieOptions,
  getSessionFromRequest,
} from "@/lib/auth/session";
import { applyCsrfCookie, createCsrfToken } from "@/lib/auth/csrf";
import { jsonError, NO_STORE_HEADERS, parseBody } from "@/lib/server/api-utils";
import { emptyObjectSchema } from "@/lib/server/schemas";

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, emptyObjectSchema);
  if (!parsed.ok) return parsed.response;

  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError("Oturum gerekli", 401);
  }

  const response = NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  applyCookie(response, clearSessionCookieOptions());
  applyCsrfCookie(response, createCsrfToken());
  return response;
}
