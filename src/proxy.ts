import { NextResponse, type NextRequest } from "next/server";
import {
  getApiPermission,
  getFirstAllowedPath,
  getPageReadPermission,
  hasPermission,
  type Role,
} from "@/lib/auth/permissions";
import { getSessionFromRequest } from "@/lib/auth/session";
import {
  CSRF_HEADER,
  applyCsrfCookie,
  createCsrfToken,
  ensureCsrfCookie,
  isCsrfValid,
  isMutatingMethod,
  readCsrfCookie,
} from "@/lib/auth/csrf";
import {
  HSTS_HEADER,
  STATIC_SECURITY_HEADERS,
  buildContentSecurityPolicy,
  createCspNonce,
} from "@/lib/security-headers";

const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/health",
];

/** Şifre değiştirmeye zorlanan kullanıcının erişebileceği tek yollar */
const PASSWORD_CHANGE_ALLOWED = [
  "/change-password",
  "/api/auth/change-password",
  "/api/auth/logout",
  "/api/auth/me",
];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPublic(pathname: string): boolean {
  return matchesPrefix(pathname, PUBLIC_PREFIXES);
}

function applyStaticSecurityHeaders(response: NextResponse): void {
  for (const { key, value } of STATIC_SECURITY_HEADERS) {
    response.headers.set(key, value);
  }
  if (process.env.NODE_ENV === "production") {
    response.headers.set(HSTS_HEADER.key, HSTS_HEADER.value);
  }
}

function withSecurityHeaders(
  request: NextRequest,
  response: NextResponse,
  nonce: string
): NextResponse {
  ensureCsrfCookie(request, response);
  applyStaticSecurityHeaders(response);
  response.headers.set(
    "Content-Security-Policy",
    buildContentSecurityPolicy(nonce)
  );
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}

function nextWithNonce(request: NextRequest, nonce: string): NextResponse {
  const csp = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  return withSecurityHeaders(
    request,
    NextResponse.next({ request: { headers: requestHeaders } }),
    nonce
  );
}

function csrfForbidden(request: NextRequest): NextResponse {
  const response = NextResponse.json(
    { error: "İstek doğrulanamadı. Sayfayı yenileyip tekrar deneyin." },
    { status: 403 }
  );
  if (!readCsrfCookie(request)) {
    applyCsrfCookie(response, createCsrfToken());
  } else {
    ensureCsrfCookie(request, response);
  }
  response.headers.set("x-csrf-required", CSRF_HEADER);
  response.headers.set("Cache-Control", "no-store, private");
  applyStaticSecurityHeaders(response);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = createCspNonce();

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (isMutatingMethod(request.method) && pathname.startsWith("/api/")) {
    if (!isCsrfValid(request)) {
      return csrfForbidden(request);
    }
  }

  const session = await getSessionFromRequest(request);

  if (pathname === "/") {
    const dest = session ? getFirstAllowedPath(session.role) : "/login";
    return withSecurityHeaders(
      request,
      NextResponse.redirect(new URL(dest, request.url)),
      nonce
    );
  }

  if (isPublic(pathname)) {
    // /login'e JWT ile gelen kullanıcıyı yönlendirmiyoruz: iptal edilmiş
    // oturumda /login ↔ /dashboard döngüsü oluşmasın. İstemci /api/auth/me
    // ile canlı oturumu kontrol edip kendisi yönlendirir.
    return nextWithNonce(request, nonce);
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(
        request,
        NextResponse.json({ error: "Oturum gerekli" }, { status: 401 }),
        nonce
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return withSecurityHeaders(
      request,
      NextResponse.redirect(loginUrl),
      nonce
    );
  }

  if (
    session.mustChangePassword &&
    !matchesPrefix(pathname, PASSWORD_CHANGE_ALLOWED)
  ) {
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(
        request,
        NextResponse.json(
          { error: "Devam etmek için şifrenizi değiştirmeniz gerekiyor" },
          { status: 403 }
        ),
        nonce
      );
    }
    return withSecurityHeaders(
      request,
      NextResponse.redirect(new URL("/change-password", request.url)),
      nonce
    );
  }

  const role = session.role as Role;

  if (pathname.startsWith("/api/")) {
    const access = getApiPermission(pathname, request.method);
    if (access.kind === "deny") {
      return withSecurityHeaders(
        request,
        NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 }),
        nonce
      );
    }
    if (
      access.kind === "require" &&
      !hasPermission(role, access.permission)
    ) {
      return withSecurityHeaders(
        request,
        NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 }),
        nonce
      );
    }
    return nextWithNonce(request, nonce);
  }

  const pagePermission = getPageReadPermission(pathname);
  if (pagePermission && !hasPermission(role, pagePermission)) {
    const fallback = getFirstAllowedPath(role);
    const url = new URL(fallback, request.url);
    url.searchParams.set("denied", "1");
    return withSecurityHeaders(request, NextResponse.redirect(url), nonce);
  }

  return nextWithNonce(request, nonce);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
