import type { DocumentSettings } from "@/data/catalog";
import {
  companyAddressLine,
  companyDisplayName,
  companyTaxLine,
  isPdfLogo,
} from "@/lib/document-company";

export function companyHeader(
  settings: DocumentSettings,
  title: string,
  subtitle?: string
): Record<string, unknown> {
  const logo =
    settings.showLogo && isPdfLogo(settings.logoDataUrl)
      ? {
          image: settings.logoDataUrl,
          fit: [88, 52],
          margin: [0, 0, 12, 0],
        }
      : null;

  const identity = {
    width: "*",
    stack: [
      { text: companyDisplayName(settings), style: "brand" },
      settings.companyName && settings.legalTitle
        ? { text: settings.companyName, fontSize: 8, color: "#555" }
        : { text: "" },
      { text: companyAddressLine(settings), fontSize: 8, color: "#444" },
      { text: companyTaxLine(settings), fontSize: 8, color: "#444" },
      settings.phone || settings.email
        ? {
            text: [settings.phone, settings.email].filter(Boolean).join("  ·  "),
            fontSize: 8,
            color: "#444",
          }
        : { text: "" },
      settings.website
        ? { text: settings.website, fontSize: 8, color: "#444" }
        : { text: "" },
    ].filter((item) => (item as { text?: string }).text !== ""),
  };

  return {
    columns: [
      logo
        ? { columns: [logo, identity], width: "*" }
        : identity,
      {
        width: 220,
        alignment: "right",
        stack: [
          { text: title, style: "docTitle" },
          subtitle
            ? { text: subtitle, fontSize: 8, color: "#555", margin: [0, 4, 0, 0] }
            : { text: "" },
        ],
      },
    ],
  };
}

export function companyFooter(settings: DocumentSettings, extra?: string) {
  const bits = [
    extra,
    settings.iban ? `IBAN: ${settings.iban}` : "",
    settings.bankName,
    settings.footerNote,
  ].filter(Boolean);
  return bits.length
    ? { text: bits.join("  ·  "), fontSize: 7, color: "#666", margin: [0, 16, 0, 0] }
    : { text: "" };
}

export const PDF_STYLES = {
  brand: { fontSize: 14, bold: true, color: "#1e3a5f" },
  docTitle: { fontSize: 16, bold: true, color: "#1e3a5f" },
  section: { fontSize: 10, bold: true, color: "#1e3a5f" },
};
