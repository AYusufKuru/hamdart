import type { NextRequest } from "next/server";
import { jsonCaught, jsonError, jsonOk, requireSession } from "@/lib/server/api-utils";
import { dbGetRawMaterialOrder } from "@/lib/server/data-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "raw_material_orders:read");
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const order = await dbGetRawMaterialOrder(id);
    if (!order) return jsonError("Bulunamadı", 404);
    return jsonOk(order);
  } catch (e) {
    return jsonCaught(e, "Sipariş yüklenemedi");
  }
}
