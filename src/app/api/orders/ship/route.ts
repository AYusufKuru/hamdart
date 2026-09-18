import type { NextRequest } from "next/server";
import {
  getIpFromRequest,
  jsonCaught,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import { dbCreateShipment } from "@/lib/server/data-service";
import { shipmentCreateSchema } from "@/lib/server/schemas";

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "orders:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, shipmentCreateSchema);
    if (!parsed.ok) return parsed.response;
    const order = await dbCreateShipment(parsed.data, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(order, 201);
  } catch (e) {
    return jsonCaught(e, "Sevk oluşturulamadı");
  }
}
