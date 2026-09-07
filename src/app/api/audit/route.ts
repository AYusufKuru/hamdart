import type { NextRequest } from "next/server";
import { jsonError, jsonOk, requireSession } from "@/lib/server/api-utils";
import { listAuditLogs } from "@/lib/server/audit";

function clampLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "100", 10);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(500, Math.max(1, parsed));
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "admin:read");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const entityType = url.searchParams.get("entityType") ?? undefined;
  const entityId = url.searchParams.get("entityId") ?? undefined;

  if (entityType && entityType.length > 64) {
    return jsonError("Geçersiz entityType", 400);
  }
  if (entityId && entityId.length > 128) {
    return jsonError("Geçersiz entityId", 400);
  }

  const logs = await listAuditLogs({ limit, entityType, entityId });
  return jsonOk(logs);
}
