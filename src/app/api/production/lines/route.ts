import type { NextRequest } from "next/server";
import {
  getIpFromRequest,
  jsonCaught,
  jsonError,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import {
  dbGetAllProductionLines,
  dbUpdateProductionLine,
} from "@/lib/server/data-service";
import { productionLinePatchSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "factory:read");
  if (!auth.ok) return auth.response;
  try {
    return jsonOk(await dbGetAllProductionLines());
  } catch (e) {
    return jsonCaught(e, "Hatlar yüklenemedi");
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSession(req, "factory:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, productionLinePatchSchema);
    if (!parsed.ok) return parsed.response;
    const updated = await dbUpdateProductionLine(
      parsed.data.id,
      parsed.data.patch,
      {
        actor: auth.session.name,
        ip: getIpFromRequest(req),
      }
    );
    if (!updated) return jsonError("Hat bulunamadı", 404);
    return jsonOk(updated);
  } catch (e) {
    return jsonCaught(e);
  }
}
