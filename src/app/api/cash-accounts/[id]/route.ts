import type { NextRequest } from "next/server";
import {
  getIpFromRequest,
  jsonCaught,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import { deleteCashAccount, updateCashAccount } from "@/lib/server/cash-accounts";
import { cashAccountUpdateSchema } from "@/lib/server/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "budget:write");
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const parsed = await parseBody(req, cashAccountUpdateSchema);
    if (!parsed.ok) return parsed.response;
    return jsonOk(
      await updateCashAccount(id, parsed.data, {
        actor: auth.session.name,
        ip: getIpFromRequest(req),
      })
    );
  } catch (e) {
    return jsonCaught(e, "Hesap güncellenemedi");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "budget:write");
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    await deleteCashAccount(id, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonCaught(e, "Hesap silinemedi");
  }
}
