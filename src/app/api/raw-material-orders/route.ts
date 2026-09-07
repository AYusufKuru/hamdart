import type { NextRequest } from "next/server";
import {
  getIpFromRequest,
  jsonCaught,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import {
  dbCreateManualRawMaterialOrder,
  dbGetAllRawMaterialOrders,
  dbPatchRawMaterialOrder,
  dbSyncReplenishmentOrders,
} from "@/lib/server/data-service";
import {
  emptyObjectSchema,
  rmoCreateSchema,
  rmoPatchSchema,
} from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "raw_material_orders:read");
  if (!auth.ok) return auth.response;
  try {
    return jsonOk(await dbGetAllRawMaterialOrders());
  } catch (e) {
    return jsonCaught(e, "Hammadde siparişleri yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "raw_material_orders:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, rmoCreateSchema);
    if (!parsed.ok) return parsed.response;
    const order = await dbCreateManualRawMaterialOrder(parsed.data, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(order, 201);
  } catch (e) {
    return jsonCaught(e);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(req, "raw_material_orders:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, rmoPatchSchema);
    if (!parsed.ok) return parsed.response;
    const order = await dbPatchRawMaterialOrder(parsed.data, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(order);
  } catch (e) {
    return jsonCaught(e);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSession(req, "raw_material_orders:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, emptyObjectSchema);
    if (!parsed.ok) return parsed.response;
    const orders = await dbSyncReplenishmentOrders({
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(orders);
  } catch (e) {
    return jsonCaught(e);
  }
}
