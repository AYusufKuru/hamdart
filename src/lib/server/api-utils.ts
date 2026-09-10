import type { NextRequest } from "next/server";
import { flattenError, type ZodError, type ZodType } from "zod";
import { getLiveSessionFromRequest } from "@/lib/auth/live-session";
import { hasPermission, type Permission, type SessionUser } from "@/lib/auth/permissions";
import { ConflictError, FieldError } from "@/lib/server/fields";

/** JSON gövde üst sınırı — aşırı büyük yükleri reddeder */
export const MAX_JSON_BODY_BYTES = 1_048_576;

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, private",
} as const;

export type SessionCheck =
  | { ok: true; session: SessionUser }
  | { ok: false; response: Response };

/**
 * Route seviyesinde oturum ve yetki doğrulaması (canlı DB oturumu).
 *
 * Proxy zaten yetki kontrolü yapar; bu yardımcı ikinci savunma hattıdır.
 * Proxy atlansa veya JWT henüz iptal edilmemiş görünse bile route kendini korur.
 */
export async function requireSession(
  req: NextRequest,
  permission?: Permission,
  opts?: { allowMustChangePassword?: boolean }
): Promise<SessionCheck> {
  const session = await getLiveSessionFromRequest(req);
  if (!session) {
    return { ok: false, response: jsonError("Oturum gerekli", 401) };
  }
  if (session.mustChangePassword && !opts?.allowMustChangePassword) {
    return {
      ok: false,
      response: jsonError(
        "Devam etmek için şifrenizi değiştirmeniz gerekiyor",
        403
      ),
    };
  }
  if (permission && !hasPermission(session.role, permission)) {
    return { ok: false, response: jsonError("Yetkiniz yok", 403) };
  }
  return { ok: true, session };
}

/** Departman yönetimi gibi işlemler yalnızca ADMIN rolüne açık. */
export async function requireAdmin(req: NextRequest): Promise<SessionCheck> {
  const auth = await requireSession(req);
  if (!auth.ok) return auth;
  if (auth.session.role !== "ADMIN") {
    return {
      ok: false,
      response: jsonError("Yalnızca yönetici erişebilir", 403),
    };
  }
  return auth;
}

/**
 * Denetim kaydındaki aktör — yalnızca imzalı canlı oturum.
 * HTTP başlıkları (x-hamdart-actor vb.) yok sayılır.
 */
export async function getActorFromRequest(req: NextRequest): Promise<string> {
  const session = await getLiveSessionFromRequest(req);
  if (!session) {
    throw new Error("Oturum gerekli");
  }
  return session.name;
}

export function getIpFromRequest(req: NextRequest): string {
  // Nginx kenarda $remote_addr yazar; istemcinin gönderdiği zincire güvenilmez.
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 128);
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  return "unknown";
}

export function jsonError(
  message: string,
  status = 400,
  extra?: { headers?: HeadersInit; fields?: Record<string, string> }
): Response {
  return Response.json(
    extra?.fields
      ? { error: message, fields: extra.fields }
      : { error: message },
    {
      status,
      headers: { ...NO_STORE_HEADERS, ...extra?.headers },
    }
  );
}

export function jsonOk(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE_HEADERS });
}

export function jsonValidationError(error: ZodError): Response {
  const flat = flattenError(error);
  const fields: Record<string, string> = {};
  for (const [key, messages] of Object.entries(flat.fieldErrors)) {
    const first = Array.isArray(messages) ? messages[0] : undefined;
    if (typeof first === "string") fields[key] = first;
  }
  if (Object.keys(fields).length === 0 && flat.formErrors[0]) {
    fields._root = flat.formErrors[0];
  }
  const first =
    Object.values(fields)[0] ?? flat.formErrors[0] ?? "Geçersiz girdi";
  return jsonError(first, 400, { fields });
}

export type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

async function readJsonBodyCapped(
  req: NextRequest
): Promise<ParsedBody<string>> {
  const declared = Number(req.headers.get("content-length") ?? Number.NaN);
  if (Number.isFinite(declared) && declared > MAX_JSON_BODY_BYTES) {
    return {
      ok: false,
      response: jsonError("İstek gövdesi çok büyük", 413),
    };
  }

  const reader = req.body?.getReader();
  if (!reader) return { ok: true, data: "" };

  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_JSON_BODY_BYTES) {
      try {
        await reader.cancel();
      } catch {
        /* yoksay */
      }
      return {
        ok: false,
        response: jsonError("İstek gövdesi çok büyük", 413),
      };
    }
    chunks.push(value);
  }

  const buf = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, data: new TextDecoder("utf-8").decode(buf) };
}

/**
 * JSON gövdeyi okur, boyutu sınırlar ve Zod şemasıyla doğrular.
 * Başarısızsa alan bazlı 400 (veya 413) Response döner.
 */
export async function parseBody<T>(
  req: NextRequest,
  schema: ZodType<T>
): Promise<ParsedBody<T>> {
  const raw = await readJsonBodyCapped(req);
  if (!raw.ok) return raw;

  const text = raw.data.trim();
  let json: unknown = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, response: jsonError("Geçersiz JSON", 400) };
    }
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return { ok: false, response: jsonValidationError(result.error) };
  }
  return { ok: true, data: result.data };
}

function isInfraError(e: unknown): boolean {
  const name = e instanceof Error ? e.name : "";
  const message = e instanceof Error ? e.message : String(e);
  if (name.startsWith("Prisma")) return true;
  return (
    message.includes("Can't reach database server") ||
    message.includes("P1001") ||
    message.includes("ECONNREFUSED") ||
    message.includes("Connection refused") ||
    /\bP\d{4}\b/.test(message)
  );
}

/** Route catch: kullanıcı hataları 400, altyapı hataları log + formatApiError */
export function jsonCaught(e: unknown, fallback = "İşlem başarısız"): Response {
  if (e instanceof FieldError) return jsonError(e.message, 400);
  if (e instanceof ConflictError) return jsonError(e.message, 409);
  if (isInfraError(e)) {
    console.error(fallback, e);
    return jsonError(formatApiError(e, fallback), 500);
  }
  if (e instanceof Error && e.message) return jsonError(e.message, 400);
  console.error(fallback, e);
  return jsonError(fallback, 500);
}

/** Prisma / ağ hatalarını kullanıcıya okunabilir mesaja çevirir */
export function formatApiError(e: unknown, fallback: string): string {
  const message = e instanceof Error ? e.message : String(e);
  if (
    message.includes("Can't reach database server") ||
    message.includes("P1001") ||
    message.includes("ECONNREFUSED") ||
    message.includes("Connection refused")
  ) {
    return "Veritabanına bağlanılamıyor. PostgreSQL sunucusunun çalıştığından emin olun.";
  }
  if (process.env.NODE_ENV === "development") {
    const firstLine = message.split("\n").find((line) => line.trim())?.trim();
    return firstLine && firstLine.length < 200 ? firstLine : fallback;
  }
  return fallback;
}

