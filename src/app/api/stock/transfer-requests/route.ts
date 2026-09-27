import type { NextRequest } from "next/server";
import { canRequestStockTransfer } from "@/lib/auth/permissions";
import {
  getIpFromRequest,
  jsonCaught,
  jsonError,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import {
  dbCreateTransferRequest,
  dbGetTransferRequestOptions,
} from "@/lib/server/data-service";
import { transferRequestCreateSchema } from "@/lib/server/schemas";

/** Kaynak depoda talep edilebilecek mamuller: ?warehouseId=... */
export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "stock:read");
  if (!auth.ok) return auth.response;
  if (!canRequestStockTransfer(auth.session)) {
    return jsonError("Transfer talebi için yetkiniz yok", 403);
  }
  const warehouseId = req.nextUrl.searchParams.get("warehouseId")?.trim();
  if (!warehouseId) return jsonError("Kaynak depo seçin", 400);
  try {
    return jsonOk(await dbGetTransferRequestOptions(warehouseId));
  } catch (e) {
    return jsonCaught(e, "Ürünler yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "stock:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, transferRequestCreateSchema);
    if (!parsed.ok) return parsed.response;
    if (!canRequestStockTransfer(auth.session, parsed.data.toWarehouseId)) {
      return jsonError("Yalnızca kendi deponuza transfer talep edebilirsiniz", 403);
    }
    const request = await dbCreateTransferRequest(parsed.data, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(request, 201);
  } catch (e) {
    return jsonCaught(e);
  }
}
