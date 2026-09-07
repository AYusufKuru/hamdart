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
  dbCreateLabExperiment,
  dbGetAllLabExperiments,
  dbNextExperimentCode,
} from "@/lib/server/data-service";
import { experimentCreateSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "lab:read");
  if (!auth.ok) return auth.response;
  try {
    return jsonOk(await dbGetAllLabExperiments());
  } catch (e) {
    return jsonCaught(e, "Deneyler yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "lab:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, experimentCreateSchema);
    if (!parsed.ok) return parsed.response;
    const experiment = await dbCreateLabExperiment(parsed.data, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(experiment, 201);
  } catch (e) {
    return jsonCaught(e);
  }
}

export async function HEAD(req: NextRequest) {
  const auth = await requireSession(req, "lab:read");
  if (!auth.ok) return auth.response;
  try {
    const code = await dbNextExperimentCode();
    return new Response(null, {
      headers: { "X-Next-Code": code, ...NO_STORE_HEADERS },
    });
  } catch (e) {
    return jsonCaught(e, "Deney kodu alınamadı");
  }
}
