import type { DocumentSettings } from "@/data/catalog";

export const EMPTY_DOCUMENT_SETTINGS: DocumentSettings = {
  id: "default",
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

export function companyDisplayName(settings: DocumentSettings) {
  return settings.legalTitle.trim() || settings.companyName.trim() || "HamdPharma";
}

export function companyAddressLine(settings: DocumentSettings) {
  return [settings.address, settings.district, settings.city]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" / ");
}

export function companyTaxLine(settings: DocumentSettings) {
  return [
    settings.taxOffice ? `Vergi Dairesi: ${settings.taxOffice}` : "",
    settings.taxNo ? `VN: ${settings.taxNo}` : "",
  ]
    .filter(Boolean)
    .join("  ");
}

export function isPdfLogo(value: string) {
  return (
    value.startsWith("data:image/png") ||
    value.startsWith("data:image/jpeg") ||
    value.startsWith("data:image/jpg") ||
    value.startsWith("data:image/webp")
  );
}
