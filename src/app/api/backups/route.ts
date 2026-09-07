import type { NextRequest } from "next/server";
import {
  jsonCaught,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import { createBackup, listBackups } from "@/lib/server/backup";
import { backupCreateSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "admin:read");
  if (!auth.ok) return auth.response;
  try {
    return jsonOk(await listBackups());
  } catch (e) {
    return jsonCaught(e, "Yedekler yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "admin:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, backupCreateSchema);
    if (!parsed.ok) return parsed.response;
    const backup = await createBackup(auth.session.name, parsed.data.note);
    return jsonOk(backup, 201);
  } catch (e) {
    return jsonCaught(e, "Yedek alınamadı");
  }
}
