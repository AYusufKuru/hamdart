import type { NextRequest } from "next/server";
import {
  getIpFromRequest,
  jsonCaught,
  jsonError,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import {
  dbDeleteBudget,
  dbDeleteCustomer,
  dbDeleteInvoice,
  dbDeleteLedger,
  dbDeletePersonnel,
  dbDeleteSupplier,
  dbUpdateBudget,
  dbUpdateCustomer,
  dbUpdateInvoice,
  dbUpdateLedger,
  dbUpdatePersonnel,
  dbUpdateSupplier,
} from "@/lib/server/catalog-write";
import { getApiPermission } from "@/lib/auth/permissions";
import {
  budgetUpdateSchema,
  customerUpdateSchema,
  invoiceUpdateSchema,
  ledgerUpdateSchema,
  personnelUpdateSchema,
  supplierUpdateSchema,
} from "@/lib/server/schemas";
import type { ZodType } from "zod";

const writable = new Set([
  "customers",
  "suppliers",
  "personnel",
  "invoices",
  "ledger",
  "budget",
]);

const updateSchemas: Record<string, ZodType> = {
  customers: customerUpdateSchema,
  suppliers: supplierUpdateSchema,
  personnel: personnelUpdateSchema,
  invoices: invoiceUpdateSchema,
  ledger: ledgerUpdateSchema,
  budget: budgetUpdateSchema,
};

async function authorize(req: NextRequest, entity: string, method: string) {
  const access = getApiPermission(`/api/catalog/${entity}`, method);
  if (access.kind === "require") {
    return requireSession(req, access.permission);
  }
  const auth = await requireSession(req);
  if (!auth.ok) return auth;
  return {
    ok: false as const,
    response: jsonError("Yetkiniz yok", 403),
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  const { entity, id } = await params;
  const auth = await authorize(req, entity, "PATCH");
  if (!auth.ok) return auth.response;
  if (!writable.has(entity)) {
    return jsonError("Bu varlık arayüzden güncellenemez", 404);
  }
  const schema = updateSchemas[entity];
  try {
    const parsed = await parseBody(req, schema);
    if (!parsed.ok) return parsed.response;
    const ctx = { actor: auth.session.name, ip: getIpFromRequest(req) };
    const data = parsed.data as never;
    switch (entity) {
      case "customers":
        return jsonOk(await dbUpdateCustomer(id, data, ctx));
      case "suppliers":
        return jsonOk(await dbUpdateSupplier(id, data, ctx));
      case "personnel":
        return jsonOk(await dbUpdatePersonnel(id, data, ctx));
      case "invoices":
        return jsonOk(await dbUpdateInvoice(id, data, ctx));
      case "ledger":
        return jsonOk(await dbUpdateLedger(id, data, ctx));
      case "budget":
        return jsonOk(await dbUpdateBudget(id, data, ctx));
      default:
        return jsonError("Geçersiz entity", 404);
    }
  } catch (e) {
    return jsonCaught(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  const { entity, id } = await params;
  const auth = await authorize(req, entity, "DELETE");
  if (!auth.ok) return auth.response;
  if (!writable.has(entity)) {
    return jsonError("Bu varlık arayüzden silinemez", 404);
  }
  try {
    const ctx = { actor: auth.session.name, ip: getIpFromRequest(req) };
    switch (entity) {
      case "customers":
        return jsonOk(await dbDeleteCustomer(id, ctx));
      case "suppliers":
        return jsonOk(await dbDeleteSupplier(id, ctx));
      case "personnel":
        await dbDeletePersonnel(id, ctx);
        return jsonOk({ ok: true });
      case "invoices":
        await dbDeleteInvoice(id, ctx);
        return jsonOk({ ok: true });
      case "ledger":
        await dbDeleteLedger(id, ctx);
        return jsonOk({ ok: true });
      case "budget":
        await dbDeleteBudget(id, ctx);
        return jsonOk({ ok: true });
      default:
        return jsonError("Geçersiz entity", 404);
    }
  } catch (e) {
    return jsonCaught(e);
  }
}
