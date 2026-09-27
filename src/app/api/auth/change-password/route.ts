import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeGrants } from "@/lib/auth/permissions";
import { invalidateSessionCache } from "@/lib/auth/live-session";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "@/lib/auth/password";
import {
  applyCookie,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import {
  jsonError,
  formatApiError,
  getIpFromRequest,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import { changePasswordBodySchema } from "@/lib/server/schemas";
import { logAudit } from "@/lib/server/audit";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSession(req, undefined, {
      allowMustChangePassword: true,
    });
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const parsed = await parseBody(req, changePasswordBodySchema);
    if (!parsed.ok) return parsed.response;
    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user || !user.active) {
      return jsonError("Kullanıcı bulunamadı veya hesap kapatılmış", 401);
    }

    const currentValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!currentValid) {
      await logAudit({
        actor: user.name,
        action: "UPDATE",
        entityType: "Auth",
        entityId: user.id,
        summary: `Şifre değiştirme başarısız: mevcut şifre hatalı (${user.username})`,
        ipAddress: getIpFromRequest(req),
      });
      return jsonError("Mevcut şifre hatalı", 400);
    }

    if (currentPassword === newPassword) {
      return jsonError("Yeni şifre mevcut şifreyle aynı olamaz", 400);
    }

    const problem = validatePassword(newPassword, {
      username: user.username,
      name: user.name,
    });
    if (problem) {
      return jsonError(problem, 400);
    }

    const passwordHash = await hashPassword(newPassword, {
      username: user.username,
      name: user.name,
    });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
    });
    invalidateSessionCache(user.id);

    await logAudit({
      actor: user.name,
      action: "UPDATE",
      entityType: "Auth",
      entityId: user.id,
      summary: `Şifre değiştirildi: ${user.username}`,
      ipAddress: getIpFromRequest(req),
    });

    const grants = normalizeGrants(user.roleGrants, user.role);
    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
      name: user.name,
      role: grants[0]?.role ?? session.role,
      grants: grants.length > 0 ? grants : session.grants,
      mustChangePassword: false,
      tokenVersion: updated.tokenVersion,
    });

    const response = NextResponse.json({ ok: true });
    applyCookie(response, sessionCookieOptions(token));
    return response;
  } catch (e) {
    return jsonError(formatApiError(e, "Şifre değiştirilemedi"), 500);
  }
}
