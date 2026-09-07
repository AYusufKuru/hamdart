import type { NextRequest } from "next/server";
import {
  getIpFromRequest,
  jsonCaught,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import {
  dbCreateStockEntry,
  dbGetAllWarehouseStockItems,
} from "@/lib/server/data-service";
import { stockCreateSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "stock:read");
  if (!auth.ok) return auth.response;
  try {
    return jsonOk(await dbGetAllWarehouseStockItems());
  } catch (e) {
    return jsonCaught(e, "Stok yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "stock:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, stockCreateSchema);
    if (!parsed.ok) return parsed.response;
    const item = await dbCreateStockEntry(parsed.data, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(item, 201);
  } catch (e) {
    return jsonCaught(e);
  }
}
