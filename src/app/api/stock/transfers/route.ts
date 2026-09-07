import type { NextRequest } from "next/server";
import {
  getIpFromRequest,
  jsonCaught,
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
    return jsonOk(await dbGetStockTransfers());
  } catch (e) {
    return jsonCaught(e, "Aktarımlar yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "stock:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, stockTransferCreateSchema);
    if (!parsed.ok) return parsed.response;
    const transfer = await dbCreateStockTransfer(parsed.data, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(transfer, 201);
  } catch (e) {
    return jsonCaught(e);
  }
}
