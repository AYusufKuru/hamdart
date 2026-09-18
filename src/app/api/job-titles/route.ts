import type { NextRequest } from "next/server";
import { createJobTitle, listJobTitles } from "@/lib/server/job-titles";
import {
  getIpFromRequest,
  jsonCaught,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import { jobTitleCreateSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  try {
    return jsonOk(await listJobTitles());
  } catch (e) {
    return jsonCaught(e, "Görevler yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "personnel:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, jobTitleCreateSchema);
    if (!parsed.ok) return parsed.response;
    return jsonOk(
      await createJobTitle(parsed.data.name, {
        actor: auth.session.name,
        ip: getIpFromRequest(req),
      }),
      201
    );
  } catch (e) {
    return jsonCaught(e, "Görev eklenemedi");
  }
}
