import type { NextRequest } from "next/server";
import {
  canCreateStockTransfer,
  canTransferBetween,
  warehouseScope,
} from "@/lib/auth/permissions";
import {
  getIpFromRequest,
  jsonCaught,
  jsonError,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import {
  dbCreateStockTransfer,
  dbGetStockTransfers,
} from "@/lib/server/data-service";
import { stockTransferCreateSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "stock:read");
  if (!auth.ok) return auth.response;
  try {
    const transfers = await dbGetStockTransfers();
    const scope = warehouseScope(auth.session);
    return jsonOk(
      scope
        ? transfers.filter(
            (t) => scope.includes(t.fromWarehouseId) || scope.includes(t.toWarehouseId)
          )
        : transfers
    );
  } catch (e) {
    return jsonCaught(e, "Aktarımlar yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "stock:write");
  if (!auth.ok) return auth.response;
  if (!canCreateStockTransfer(auth.session)) {
    return jsonError("Stok aktarımı için yetkiniz yok", 403);
  }
  try {
    const parsed = await parseBody(req, stockTransferCreateSchema);
    if (!parsed.ok) return parsed.response;
    const session = auth.session;
    const transfer = await dbCreateStockTransfer(
      parsed.data,
      { actor: session.name, ip: getIpFromRequest(req) },
      (from, to) => canTransferBetween(session, from, to)
    );
    return jsonOk(transfer, 201);
  } catch (e) {
    return jsonCaught(e);
  }
}
