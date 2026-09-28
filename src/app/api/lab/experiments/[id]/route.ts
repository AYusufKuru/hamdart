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
  dbAddExperimentStep,
  dbCompleteLabExperiment,
  dbGetLabExperiment,
  dbRemoveExperimentMaterial,
  dbSaveExperimentRecipe,
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
    if (parsed.data.action === "add_step") {
      const experiment = await dbAddExperimentStep(
        id,
        {
          reason: parsed.data.reason,
          materials: parsed.data.materials,
        },
        ctx
      );
      return jsonOk(experiment);
    }
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
    if (parsed.data.action === "save_recipe") {
      const experiment = await dbSaveExperimentRecipe(
        id,
        { productName: parsed.data.productName },
        ctx
      );
      return jsonOk(experiment);
    }
    if (parsed.data.action === "remove_material") {
      const experiment = await dbRemoveExperimentMaterial(
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
