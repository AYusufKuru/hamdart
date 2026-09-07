import type { NextRequest } from "next/server";
import { createUser, listUsers, UserInputError } from "@/lib/server/users";
import {
  formatApiError,
  getIpFromRequest,
  jsonError,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import { userCreateSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "admin:read");
  if (!auth.ok) return auth.response;

  try {
    return jsonOk(await listUsers());
  } catch (e) {
    console.error("Kullanıcılar yüklenemedi:", e);
    return jsonError(formatApiError(e, "Kullanıcılar yüklenemedi"), 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "admin:write");
  if (!auth.ok) return auth.response;

  try {
    const parsed = await parseBody(req, userCreateSchema);
    if (!parsed.ok) return parsed.response;
    const user = await createUser(parsed.data, auth.session, getIpFromRequest(req));
    return jsonOk(user, 201);
  } catch (e) {
    if (e instanceof UserInputError) return jsonError(e.message, 400);
    console.error("Kullanıcı oluşturulamadı:", e);
    return jsonError(formatApiError(e, "Kullanıcı oluşturulamadı"), 500);
  }
}
