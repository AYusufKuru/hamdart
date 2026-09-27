import type { NextRequest } from "next/server";
import { canAdvanceStockTransfer, canCreateStockTransfer } from "@/lib/auth/permissions";
import {
  getIpFromRequest,
  jsonCaught,
  jsonError,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import { dbAdvanceStockTransfer } from "@/lib/server/data-service";
import { stockTransferAdvanceSchema } from "@/lib/server/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "stock:write");
  if (!auth.ok) return auth.response;
  if (!canCreateStockTransfer(auth.session)) {
    return jsonError("Sevkiyat güncellemek için yetkiniz yok", 403);
  }
  const { id } = await params;
  try {
    const parsed = await parseBody(req, stockTransferAdvanceSchema);
    if (!parsed.ok) return parsed.response;
    const session = auth.session;
    const action = parsed.data.action;
    return jsonOk(
      await dbAdvanceStockTransfer(
        id,
        action,
        { actor: auth.session.name, ip: getIpFromRequest(req) },
        (transfer) => canAdvanceStockTransfer(session, transfer, action)
      )
    );
  } catch (e) {
    return jsonCaught(e, "Sevkiyat güncellenemedi");
  }
}
