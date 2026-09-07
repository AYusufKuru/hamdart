import type { NextRequest } from "next/server";
import {
  getIpFromRequest,
  jsonCaught,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import { dbApplyRawMaterialOrderAction } from "@/lib/server/data-service";
import { rmoActionSchema } from "@/lib/server/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "raw_material_orders:write");
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const parsed = await parseBody(req, rmoActionSchema);
    if (!parsed.ok) return parsed.response;
    const order = await dbApplyRawMaterialOrderAction(id, parsed.data.action, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(order);
  } catch (e) {
    return jsonCaught(e);
  }
}
