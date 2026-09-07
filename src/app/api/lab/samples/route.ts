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
  dbCreateLabSample,
  dbGetAllLabSamples,
  dbNextSampleNo,
} from "@/lib/server/data-service";
import { sampleCreateSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "lab:read");
  if (!auth.ok) return auth.response;
  try {
    return jsonOk(await dbGetAllLabSamples());
  } catch (e) {
    return jsonCaught(e, "Numuneler yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "lab:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, sampleCreateSchema);
    if (!parsed.ok) return parsed.response;
    const sample = await dbCreateLabSample(parsed.data, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(sample, 201);
  } catch (e) {
    return jsonCaught(e);
  }
}

export async function HEAD(req: NextRequest) {
  const auth = await requireSession(req, "lab:read");
  if (!auth.ok) return auth.response;
  try {
    const sampleNo = await dbNextSampleNo();
    return new Response(null, {
      headers: { "X-Next-Sample-No": sampleNo, ...NO_STORE_HEADERS },
    });
  } catch (e) {
    return jsonCaught(e, "Numune numarası alınamadı");
  }
}
