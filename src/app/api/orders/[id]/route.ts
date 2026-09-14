import type { NextRequest } from "next/server";
import {
  getIpFromRequest,
  jsonCaught,
  jsonError,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import { canSetOrderStatus } from "@/lib/auth/permissions";
import { dbGetOrder, dbUpdateOrderShipment } from "@/lib/server/data-service";
import { orderShipmentSchema } from "@/lib/server/schemas";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "orders:read");
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const order = await dbGetOrder(id);
    if (!order) return jsonError("Bulunamadı", 404);
    return jsonOk(order);
  } catch (e) {
    return jsonCaught(e, "Sipariş yüklenemedi");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "orders:write");
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const parsed = await parseBody(req, orderShipmentSchema);
    if (!parsed.ok) return parsed.response;
    if (
      parsed.data.status &&
      !canSetOrderStatus(auth.session.role, parsed.data.status)
    ) {
      return jsonError("Bu sevkiyat durumunu güncelleme yetkiniz yok", 403);
    }
    const order = await dbUpdateOrderShipment(id, parsed.data, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(order);
  } catch (e) {
    return jsonCaught(e, "Sevkiyat güncellenemedi");
  }
}
