import type { NextRequest } from "next/server";
import {
  getIpFromRequest,
  jsonCaught,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import { dbCompleteLabSample } from "@/lib/server/data-service";
import { sampleCompleteSchema } from "@/lib/server/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "lab:write");
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const parsed = await parseBody(req, sampleCompleteSchema);
    if (!parsed.ok) return parsed.response;
    const sample = await dbCompleteLabSample(id, parsed.data, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(sample);
  } catch (e) {
    return jsonCaught(e, "Numune tamamlanamadı");
  }
}
