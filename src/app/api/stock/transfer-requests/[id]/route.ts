import type { NextRequest } from "next/server";
import { canRespondTransferRequest } from "@/lib/auth/permissions";
import {
  getIpFromRequest,
  jsonCaught,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import { dbRespondTransferRequest } from "@/lib/server/data-service";
import { transferRequestRespondSchema } from "@/lib/server/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "stock:write");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const parsed = await parseBody(req, transferRequestRespondSchema);
    if (!parsed.ok) return parsed.response;
    const session = auth.session;
    return jsonOk(
      await dbRespondTransferRequest(
        id,
        parsed.data,
        { actor: session.name, ip: getIpFromRequest(req) },
        (request) => canRespondTransferRequest(session, request)
      )
    );
  } catch (e) {
    return jsonCaught(e, "Talep yanıtlanamadı");
  }
}
