/**
 * Double-submit CSRF belirteci — Edge (proxy) ve Node'da çalışır.
 *
 * Çerez httpOnly DEĞİLDİR; istemci değeri okuyup x-csrf-token başlığında
 * geri gönderir. SameSite=Lax zaten çapraz site POST'u kısıtlar; bu katman
 * aynı sitedeki başka kökenli formları da (ör. eski tarayıcı) keser.
 */
import type { NextRequest, NextResponse } from "next/server";
import { cookieSecure } from "@/lib/auth/cookie-secure";
import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/auth/csrf-constants";

export { CSRF_COOKIE, CSRF_HEADER };

const CSRF_MAX_AGE_SEC = 60 * 60 * 8;

function csrfSecure(): boolean {
  return cookieSecure();
}

export function createCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function csrfCookieOptions(token: string) {
  return {
    name: CSRF_COOKIE,
    value: token,
    httpOnly: false,
    sameSite: "lax" as const,
    secure: csrfSecure(),
    path: "/",
    maxAge: CSRF_MAX_AGE_SEC,
  };
}

export function applyCsrfCookie(
  response: NextResponse,
  token: string
): void {
  const opts = csrfCookieOptions(token);
  response.cookies.set(opts.name, opts.value, {
    httpOnly: opts.httpOnly,
    sameSite: opts.sameSite,
    secure: opts.secure,
    path: opts.path,
    maxAge: opts.maxAge,
  });
}

/** Sabit süreli karşılaştırma — uzunluk farklıysa da dolaşır */
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let out = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    out |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
  }
  return out === 0;
}

export function readCsrfCookie(req: NextRequest): string | undefined {
  return req.cookies.get(CSRF_COOKIE)?.value;
}

export function isMutatingMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

export function isCsrfValid(req: NextRequest): boolean {
  const cookie = readCsrfCookie(req);
  const header = req.headers.get(CSRF_HEADER)?.trim();
  if (!cookie || !header) return false;
  return timingSafeEqual(cookie, header);
}

/**
 * Çerez yoksa üretir ve yanıta yazar. Var olan çerezi döndürür (üzerine yazmaz).
 */
export function ensureCsrfCookie(
  req: NextRequest,
  response: NextResponse
): string {
  const existing = readCsrfCookie(req);
  if (existing) return existing;
  const token = createCsrfToken();
  applyCsrfCookie(response, token);
  return token;
}
