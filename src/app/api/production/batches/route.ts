import type { NextRequest } from "next/server";
import {
  getIpFromRequest,
  jsonCaught,
  jsonOk,
  NO_STORE_HEADERS,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import {
  dbCreateProductionBatch,
  dbGetAllProductionBatches,
  dbNextBatchNo,
  dbUpdateProductionBatch,
} from "@/lib/server/data-service";
import { batchCreateSchema, batchPatchSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "factory:read");
  if (!auth.ok) return auth.response;
  try {
    return jsonOk(await dbGetAllProductionBatches());
  } catch (e) {
    return jsonCaught(e, "Partiler yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "factory:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, batchCreateSchema);
    if (!parsed.ok) return parsed.response;
    const batch = await dbCreateProductionBatch(parsed.data, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(batch, 201);
  } catch (e) {
    return jsonCaught(e);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSession(req, "factory:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, batchPatchSchema);
    if (!parsed.ok) return parsed.response;
    const batch = await dbUpdateProductionBatch(
      parsed.data.id,
      { action: parsed.data.action, patch: parsed.data.patch },
      {
        actor: auth.session.name,
        ip: getIpFromRequest(req),
      }
    );
    return jsonOk(batch);
  } catch (e) {
    return jsonCaught(e);
  }
}

export async function HEAD(req: NextRequest) {
  const auth = await requireSession(req, "factory:read");
  if (!auth.ok) return auth.response;
  try {
    const line = req.headers.get("X-Line-Name") ?? "";
    const batchNo = await dbNextBatchNo(line);
    return new Response(null, {
      headers: { "X-Next-Batch-No": batchNo, ...NO_STORE_HEADERS },
    });
  } catch (e) {
    return jsonCaught(e, "Parti numarası alınamadı");
  }
}
