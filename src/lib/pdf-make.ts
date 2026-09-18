type PdfMake = {
  addVirtualFileSystem: (vfs: unknown) => void;
  createPdf: (doc: Record<string, unknown>) => {
    download: (name: string) => Promise<void>;
  };
};

let pdfMakeCache: PdfMake | null = null;

function unwrapModule<T>(mod: unknown): T {
  let current = mod as { default?: unknown; createPdf?: unknown };
  for (let i = 0; i < 4; i++) {
    if (current && typeof current.createPdf === "function") {
      return current as T;
    }
    if (current && current.default !== undefined) {
      current = current.default as { default?: unknown; createPdf?: unknown };
      continue;
    }
    break;
  }
  return current as T;
}

export async function loadPdfMake(): Promise<PdfMake> {
  if (pdfMakeCache) return pdfMakeCache;
  const [pdfMod, fontsMod] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfMake = unwrapModule<PdfMake>(pdfMod);
  const vfs = (fontsMod as { default?: unknown }).default ?? fontsMod;
  pdfMake.addVirtualFileSystem(vfs);
  pdfMakeCache = pdfMake;
  return pdfMake;
}

export function pdfMoney(value: number, currency = "TRY") {
  const formatted = Number(value.toFixed(2)).toLocaleString("tr-TR");
  if (currency === "TRY" || currency === "TL") return `${formatted} ₺`;
  return `${formatted} ${currency}`;
}

export function pdfCell(text: string, extra?: Record<string, unknown>) {
  return { text: text || "—", fontSize: 8, ...extra };
}
