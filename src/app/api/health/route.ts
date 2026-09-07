import { prisma } from "@/lib/db";
import { NO_STORE_HEADERS } from "@/lib/server/api-utils";

/**
 * Kimlik doğrulamasız canlılık kontrolü.
 * Yanıtta sürüm, host, hata metni veya veritabanı ayrıntısı yok.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
  } catch {
    return Response.json(
      { ok: false },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
}
