import type { NextRequest } from "next/server";
import {
  getIpFromRequest,
  jsonCaught,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import { dbCreateOrder, dbGetAllOrders } from "@/lib/server/data-service";
import { orderCreateSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "orders:read");
  if (!auth.ok) return auth.response;
  try {
    return jsonOk(await dbGetAllOrders());
  } catch (e) {
    return jsonCaught(e, "Siparişler yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "orders:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, orderCreateSchema);
    if (!parsed.ok) return parsed.response;
    const order = await dbCreateOrder(parsed.data, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(order, 201);
  } catch (e) {
    return jsonCaught(e);
  }
}
