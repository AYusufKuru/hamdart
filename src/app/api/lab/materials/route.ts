import type { NextRequest } from "next/server";
import { jsonCaught, jsonOk, requireSession } from "@/lib/server/api-utils";
import { dbGetLabExperimentMaterials } from "@/lib/server/data-service";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "lab:read");
  if (!auth.ok) return auth.response;
  try {
    return jsonOk(await dbGetLabExperimentMaterials());
  } catch (e) {
    return jsonCaught(e, "Hammadde listesi yüklenemedi");
  }
}
