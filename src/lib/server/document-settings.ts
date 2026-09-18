import type { DocumentSettings } from "@/data/catalog";
import { prisma } from "@/lib/db";

export const DEFAULT_DOCUMENT_SETTINGS: Omit<DocumentSettings, "id"> = {
  companyName: "HamdPharma",
  legalTitle: "HamdPharma İlaç San. ve Tic. Ltd. Şti.",
  taxOffice: "",
  taxNo: "",
  mersisNo: "",
  tradeRegister: "",
  address: "Türkiye",
  city: "",
  district: "",
  phone: "",
  email: "",
  website: "",
  iban: "",
  bankName: "",
  authorizedName: "",
  footerNote: "Bu belge elektronik ortamda oluşturulmuştur.",
  logoDataUrl: "",
  showLogo: true,
};

export function toDocumentSettings(row: Partial<DocumentSettings> & { id?: string }): DocumentSettings {
  return {
    id: row.id || "default",
    companyName: row.companyName ?? DEFAULT_DOCUMENT_SETTINGS.companyName,
    legalTitle: row.legalTitle ?? "",
    taxOffice: row.taxOffice ?? "",
    taxNo: row.taxNo ?? "",
    mersisNo: row.mersisNo ?? "",
    tradeRegister: row.tradeRegister ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    district: row.district ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    website: row.website ?? "",
    iban: row.iban ?? "",
    bankName: row.bankName ?? "",
    authorizedName: row.authorizedName ?? "",
    footerNote: row.footerNote ?? "",
    logoDataUrl: row.logoDataUrl ?? "",
    showLogo: row.showLogo ?? true,
  };
}

export async function getDocumentSettings(): Promise<DocumentSettings> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT * FROM "DocumentSettings" WHERE "id" = 'default' LIMIT 1
  `;
  if (rows[0]) return toDocumentSettings(rows[0] as unknown as DocumentSettings);
  await prisma.$executeRaw`
    INSERT INTO "DocumentSettings" ("id", "companyName", "legalTitle", "address", "footerNote", "showLogo", "updatedAt")
    VALUES ('default', ${DEFAULT_DOCUMENT_SETTINGS.companyName}, ${DEFAULT_DOCUMENT_SETTINGS.legalTitle}, ${DEFAULT_DOCUMENT_SETTINGS.address}, ${DEFAULT_DOCUMENT_SETTINGS.footerNote}, true, CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO NOTHING
  `;
  return { id: "default", ...DEFAULT_DOCUMENT_SETTINGS };
}

export async function saveDocumentSettings(
  input: Omit<DocumentSettings, "id">
): Promise<DocumentSettings> {
  await prisma.$executeRaw`
    INSERT INTO "DocumentSettings" (
      "id", "companyName", "legalTitle", "taxOffice", "taxNo", "mersisNo", "tradeRegister",
      "address", "city", "district", "phone", "email", "website", "iban", "bankName",
      "authorizedName", "footerNote", "logoDataUrl", "showLogo", "updatedAt"
    ) VALUES (
      'default', ${input.companyName}, ${input.legalTitle}, ${input.taxOffice}, ${input.taxNo},
      ${input.mersisNo}, ${input.tradeRegister}, ${input.address}, ${input.city}, ${input.district},
      ${input.phone}, ${input.email}, ${input.website}, ${input.iban}, ${input.bankName},
      ${input.authorizedName}, ${input.footerNote}, ${input.logoDataUrl}, ${input.showLogo},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("id") DO UPDATE SET
      "companyName" = EXCLUDED."companyName",
      "legalTitle" = EXCLUDED."legalTitle",
      "taxOffice" = EXCLUDED."taxOffice",
      "taxNo" = EXCLUDED."taxNo",
      "mersisNo" = EXCLUDED."mersisNo",
      "tradeRegister" = EXCLUDED."tradeRegister",
      "address" = EXCLUDED."address",
      "city" = EXCLUDED."city",
      "district" = EXCLUDED."district",
      "phone" = EXCLUDED."phone",
      "email" = EXCLUDED."email",
      "website" = EXCLUDED."website",
      "iban" = EXCLUDED."iban",
      "bankName" = EXCLUDED."bankName",
      "authorizedName" = EXCLUDED."authorizedName",
      "footerNote" = EXCLUDED."footerNote",
      "logoDataUrl" = EXCLUDED."logoDataUrl",
      "showLogo" = EXCLUDED."showLogo",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
  return { id: "default", ...input };
}
