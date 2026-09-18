import type { NextRequest } from "next/server";
import { deleteJobTitle } from "@/lib/server/job-titles";
import {
  getIpFromRequest,
  jsonCaught,
  jsonOk,
  requireSession,
} from "@/lib/server/api-utils";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "personnel:write");
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    await deleteJobTitle(id, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonCaught(e, "Görev silinemedi");
  }
}
