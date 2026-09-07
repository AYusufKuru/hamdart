import type { NextRequest } from "next/server";
import { deleteUser, updateUser, UserInputError } from "@/lib/server/users";
import {
  formatApiError,
  getIpFromRequest,
  jsonError,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import { userUpdateSchema } from "@/lib/server/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "admin:write");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const parsed = await parseBody(req, userUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const user = await updateUser(
      id,
      parsed.data,
      auth.session,
      getIpFromRequest(req)
    );
    return jsonOk(user);
  } catch (e) {
    if (e instanceof UserInputError) return jsonError(e.message, 400);
    console.error("Kullanıcı güncellenemedi:", e);
    return jsonError(formatApiError(e, "Kullanıcı güncellenemedi"), 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "admin:write");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    await deleteUser(id, auth.session, getIpFromRequest(req));
    return jsonOk({ ok: true });
  } catch (e) {
    if (e instanceof UserInputError) return jsonError(e.message, 400);
    console.error("Kullanıcı silinemedi:", e);
    return jsonError(formatApiError(e, "Kullanıcı silinemedi"), 500);
  }
}
