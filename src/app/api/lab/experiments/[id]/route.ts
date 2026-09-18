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
  dbAddExperimentMaterial,
  dbCompleteLabExperiment,
  dbGetLabExperiment,
} from "@/lib/server/data-service";
import { experimentPatchSchema } from "@/lib/server/schemas";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "lab:read");
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const experiment = await dbGetLabExperiment(id);
    if (!experiment) return jsonError("Deney bulunamadı", 404);
    return jsonOk(experiment);
  } catch (e) {
    return jsonCaught(e, "Deney yüklenemedi");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "lab:write");
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const parsed = await parseBody(req, experimentPatchSchema);
    if (!parsed.ok) return parsed.response;
    const ctx = {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    };
    if (parsed.data.action === "add_material") {
      const experiment = await dbAddExperimentMaterial(
        id,
        {
          stockItemId: parsed.data.stockItemId,
          quantity: parsed.data.quantity,
          reason: parsed.data.reason,
        },
        ctx
      );
      return jsonOk(experiment);
    }
    const experiment = await dbCompleteLabExperiment(
      id,
      { completionNote: parsed.data.completionNote },
      ctx
    );
    return jsonOk(experiment);
  } catch (e) {
    return jsonCaught(e, "Deney güncellenemedi");
  }
}
