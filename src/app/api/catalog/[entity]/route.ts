import type { NextRequest } from "next/server";
import {
  getIpFromRequest,
  jsonCaught,
  jsonError,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import type { Personnel } from "@/data/catalog";
import {
  dbGetBudget,
  dbGetCustomers,
  dbGetInvoiceLines,
  dbGetInvoices,
  dbGetLedger,
  dbGetPersonnel,
  dbGetProducts,
  dbGetSuppliers,
  dbGetWarehouses,
} from "@/lib/server/data-service";
import {
  dbCreateBudget,
  dbCreateCustomer,
  dbCreateInvoice,
  dbCreateLedger,
  dbCreatePersonnel,
  dbCreateSupplier,
  maskPersonnel,
} from "@/lib/server/catalog-write";
import { getApiPermission, hasPermission } from "@/lib/auth/permissions";
import {
  budgetCreateSchema,
  customerCreateSchema,
  invoiceCreateSchema,
  ledgerCreateSchema,
  personnelCreateSchema,
  supplierCreateSchema,
} from "@/lib/server/schemas";
import type { ZodType } from "zod";

const readers: Record<string, () => Promise<unknown>> = {
  customers: dbGetCustomers,
  suppliers: dbGetSuppliers,
  personnel: dbGetPersonnel,
  products: dbGetProducts,
  invoices: dbGetInvoices,
  "invoice-lines": dbGetInvoiceLines,
  ledger: dbGetLedger,
  budget: dbGetBudget,
  warehouses: dbGetWarehouses,
};

const writable = new Set([
  "customers",
  "suppliers",
  "personnel",
  "invoices",
  "ledger",
  "budget",
]);

const createSchemas: Record<string, ZodType> = {
  customers: customerCreateSchema,
  suppliers: supplierCreateSchema,
  personnel: personnelCreateSchema,
  invoices: invoiceCreateSchema,
  ledger: ledgerCreateSchema,
  budget: budgetCreateSchema,
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const { entity } = await params;
  const auth = await authorize(req, entity, "GET");
  if (!auth.ok) return auth.response;

  const handler = readers[entity];
  if (!handler) {
    return jsonError("Geçersiz entity", 404);
  }
  try {
    const data = await handler();
    if (entity === "personnel" && Array.isArray(data)) {
      if (!hasPermission(auth.session.role, "personnel:write")) {
        return jsonOk(
          (data as Personnel[]).map((row) => maskPersonnel(row))
        );
      }
    }
    return jsonOk(data);
  } catch (e) {
    return jsonCaught(e, "Katalog yüklenemedi");
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const { entity } = await params;
  const auth = await authorize(req, entity, "POST");
  if (!auth.ok) return auth.response;
  if (!writable.has(entity)) {
    return jsonError("Bu varlık arayüzden eklenemez", 404);
  }
  const schema = createSchemas[entity];
  try {
    const parsed = await parseBody(req, schema);
    if (!parsed.ok) return parsed.response;
    const ctx = { actor: auth.session.name, ip: getIpFromRequest(req) };
    const data = parsed.data as never;
    switch (entity) {
      case "customers":
        return jsonOk(await dbCreateCustomer(data, ctx), 201);
      case "suppliers":
        return jsonOk(await dbCreateSupplier(data, ctx), 201);
      case "personnel":
        return jsonOk(await dbCreatePersonnel(data, ctx), 201);
      case "invoices":
        return jsonOk(await dbCreateInvoice(data, ctx), 201);
      case "ledger":
        return jsonOk(await dbCreateLedger(data, ctx), 201);
      case "budget":
        return jsonOk(await dbCreateBudget(data, ctx), 201);
      default:
        return jsonError("Geçersiz entity", 404);
    }
  } catch (e) {
    return jsonCaught(e);
  }
}
