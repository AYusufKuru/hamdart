import type { NextRequest } from "next/server";
import {
  jsonCaught,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import { deleteBackup, restoreBackup } from "@/lib/server/backup";
import { backupRestoreSchema } from "@/lib/server/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "admin:write");
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const parsed = await parseBody(req, backupRestoreSchema);
    if (!parsed.ok) return parsed.response;
    await restoreBackup(id, auth.session.name, parsed.data.confirmFilename);
    return jsonOk({ ok: true, message: "Geri yükleme tamamlandı" });
  } catch (e) {
    return jsonCaught(e, "Geri yükleme başarısız");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "admin:write");
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    await deleteBackup(id, auth.session.name);
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonCaught(e, "Yedek silinemedi");
  }
}
