import type { NextRequest } from "next/server";
import { jsonCaught, jsonError, jsonOk, requireSession } from "@/lib/server/api-utils";
import { dbGetLabPeople } from "@/lib/server/data-service";
import type { LabPersonRole } from "@/lib/personnel";

function parseRole(value: string | null): LabPersonRole | null {
  if (value === "analyst" || value === "researcher") return value;
  return null;
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "lab:read");
  if (!auth.ok) return auth.response;
  try {
    const role = parseRole(req.nextUrl.searchParams.get("role"));
    if (!role) return jsonError("Analist veya araştırmacı rolü gerekli", 400);
    return jsonOk(await dbGetLabPeople(role));
  } catch (e) {
    return jsonCaught(e, "Laboratuvar çalışanları yüklenemedi");
  }
}
