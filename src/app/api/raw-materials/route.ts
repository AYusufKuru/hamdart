import type { NextRequest } from "next/server";
import {
  getIpFromRequest,
  jsonCaught,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import {
  dbCreateRawMaterial,
  dbGetAllRawMaterials,
} from "@/lib/server/data-service";
import { rawMaterialCreateSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "raw_materials:read");
  if (!auth.ok) return auth.response;
  try {
    return jsonOk(await dbGetAllRawMaterials());
  } catch (e) {
    return jsonCaught(e, "Hammaddeler yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "raw_materials:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, rawMaterialCreateSchema);
    if (!parsed.ok) return parsed.response;
    const material = await dbCreateRawMaterial(parsed.data, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(material, 201);
  } catch (e) {
    return jsonCaught(e);
  }
}
