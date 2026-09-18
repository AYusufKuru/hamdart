import type { NextRequest } from "next/server";
import {
  getIpFromRequest,
  jsonCaught,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import { createBankAccount, listCashAccounts } from "@/lib/server/cash-accounts";
import { cashAccountCreateSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "budget:read");
  if (!auth.ok) return auth.response;
  try {
    return jsonOk(await listCashAccounts());
  } catch (e) {
    return jsonCaught(e, "Kasa hesapları yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "budget:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, cashAccountCreateSchema);
    if (!parsed.ok) return parsed.response;
    return jsonOk(
      await createBankAccount(parsed.data, {
        actor: auth.session.name,
        ip: getIpFromRequest(req),
      }),
      201
    );
  } catch (e) {
    return jsonCaught(e, "Banka hesabı eklenemedi");
  }
}
