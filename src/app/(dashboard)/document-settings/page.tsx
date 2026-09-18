"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ImagePlus, Save, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormField,
  FormSection,
} from "@/components/shared/form-sheet";
import { CanWrite } from "@/components/auth/can-write";
import type { DocumentSettings } from "@/data/catalog";
import {
  fetchDocumentSettings,
  saveDocumentSettings,
} from "@/lib/catalog-store";
import { EMPTY_DOCUMENT_SETTINGS } from "@/lib/document-company";
import { useAuth } from "@/lib/auth/auth-context";

function formFrom(row: DocumentSettings) {
  return {
    companyName: row.companyName,
    legalTitle: row.legalTitle,
    taxOffice: row.taxOffice,
    taxNo: row.taxNo,
    mersisNo: row.mersisNo,
    tradeRegister: row.tradeRegister,
    address: row.address,
    city: row.city,
    district: row.district,
    phone: row.phone,
    email: row.email,
    website: row.website,
    iban: row.iban,
    bankName: row.bankName,
    authorizedName: row.authorizedName,
    footerNote: row.footerNote,
    logoDataUrl: row.logoDataUrl,
    showLogo: row.showLogo,
  };
}

function readLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Yalnızca görsel dosyaları yüklenebilir"));
      return;
    }
    if (file.size > 1_500_000) {
      reject(new Error("Logo 1.5 MB altında olmalıdır"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Logo okunamadı"));
    reader.onload = () => {
      const src = String(reader.result || "");
      const img = new Image();
      img.onload = () => {
        const maxW = 420;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export default function DocumentSettingsPage() {
  const router = useRouter();
  const { canWrite } = useAuth();
  const writable = canWrite("invoices");
  const [form, setForm] = useState(() => formFrom(EMPTY_DOCUMENT_SETTINGS));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setForm(formFrom(await fetchDocumentSettings()));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ayarlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleLogo(file: File | undefined) {
    if (!file) return;
    try {
      const logoDataUrl = await readLogoFile(file);
      if (logoDataUrl.length > 900_000) {
        toast.error("Logo sıkıştırıldıktan sonra da büyük; daha küçük bir görsel seçin");
        return;
      }
      setForm((f) => ({ ...f, logoDataUrl, showLogo: true }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo yüklenemedi");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName.trim()) {
      toast.error("Firma adı zorunludur");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveDocumentSettings({
        ...form,
        companyName: form.companyName.trim(),
        legalTitle: form.legalTitle.trim(),
      });
      setForm(formFrom(saved));
      toast.success("PDF ayarları kaydedildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="rounded-xl -ml-2"
        onClick={() => {
          if (window.history.length > 1) {
            router.back();
            return;
          }
          router.push("/invoices");
        }}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Geri
      </Button>
      <PageHeader
        badge="Sistem"
        title="PDF ayarları"
        description="Fatura, fiyat teklifi ve sevk irsaliyesi çıktılarında kullanılacak firma bilgisi ve logo."
      />
      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <form className="space-y-8" onSubmit={handleSubmit}>
            <FormSection title="Logo" description="PNG veya JPEG. Çıktının sol üstünde görünür.">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-2xl border bg-white">
                  {form.logoDataUrl ? (
                    <img src={form.logoDataUrl} alt="Firma logosu" className="max-h-24 max-w-40 object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Logo yok</span>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                    <ImagePlus className="h-4 w-4" />
                    Logo seç
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={!writable}
                      onChange={(e) => void handleLogo(e.target.files?.[0])}
                    />
                  </label>
                  {form.logoDataUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!writable}
                      onClick={() => setForm((f) => ({ ...f, logoDataUrl: "" }))}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Logoyu kaldır
                    </Button>
                  ) : null}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.showLogo}
                      disabled={!writable}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, showLogo: e.target.checked }))
                      }
                    />
                    Logoyu PDF’te göster
                  </label>
                </div>
              </div>
            </FormSection>

            <FormSection title="Firma">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Kısa ad" htmlFor="ds-name" required>
                  <Input
                    id="ds-name"
                    required
                    disabled={!writable}
                    value={form.companyName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, companyName: e.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Ticari unvan" htmlFor="ds-title" optional>
                  <Input
                    id="ds-title"
                    disabled={!writable}
                    value={form.legalTitle}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, legalTitle: e.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Vergi dairesi" htmlFor="ds-vd" optional>
                  <Input
                    id="ds-vd"
                    disabled={!writable}
                    value={form.taxOffice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, taxOffice: e.target.value }))
                    }
                  />
                </FormField>
                <FormField label="VKN / TCKN" htmlFor="ds-tax" optional>
                  <Input
                    id="ds-tax"
                    disabled={!writable}
                    value={form.taxNo}
                    onChange={(e) => setForm((f) => ({ ...f, taxNo: e.target.value }))}
                  />
                </FormField>
                <FormField label="MERSİS" htmlFor="ds-mersis" optional>
                  <Input
                    id="ds-mersis"
                    disabled={!writable}
                    value={form.mersisNo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, mersisNo: e.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Ticaret sicil" htmlFor="ds-sicil" optional>
                  <Input
                    id="ds-sicil"
                    disabled={!writable}
                    value={form.tradeRegister}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tradeRegister: e.target.value }))
                    }
                  />
                </FormField>
              </div>
              <FormField label="Adres" htmlFor="ds-addr" optional>
                <Textarea
                  id="ds-addr"
                  disabled={!writable}
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </FormField>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="İlçe" htmlFor="ds-dist" optional>
                  <Input
                    id="ds-dist"
                    disabled={!writable}
                    value={form.district}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, district: e.target.value }))
                    }
                  />
                </FormField>
                <FormField label="İl" htmlFor="ds-city" optional>
                  <Input
                    id="ds-city"
                    disabled={!writable}
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </FormField>
                <FormField label="Telefon" htmlFor="ds-phone" optional>
                  <Input
                    id="ds-phone"
                    disabled={!writable}
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </FormField>
                <FormField label="E-posta" htmlFor="ds-mail" optional>
                  <Input
                    id="ds-mail"
                    type="email"
                    disabled={!writable}
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </FormField>
                <FormField label="Web" htmlFor="ds-web" optional>
                  <Input
                    id="ds-web"
                    disabled={!writable}
                    value={form.website}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, website: e.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Yetkili" htmlFor="ds-auth" optional>
                  <Input
                    id="ds-auth"
                    disabled={!writable}
                    value={form.authorizedName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, authorizedName: e.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Banka" htmlFor="ds-bank" optional>
                  <Input
                    id="ds-bank"
                    disabled={!writable}
                    value={form.bankName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, bankName: e.target.value }))
                    }
                  />
                </FormField>
                <FormField label="IBAN" htmlFor="ds-iban" optional>
                  <Input
                    id="ds-iban"
                    className="font-mono"
                    disabled={!writable}
                    value={form.iban}
                    onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
                  />
                </FormField>
              </div>
              <FormField label="PDF dipnotu" htmlFor="ds-foot" optional>
                <Textarea
                  id="ds-foot"
                  disabled={!writable}
                  value={form.footerNote}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, footerNote: e.target.value }))
                  }
                />
              </FormField>
            </FormSection>

            <CanWrite resource="invoices">
              <div className="flex justify-end">
                <Button type="submit" disabled={saving || loading} className="rounded-2xl">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Kaydediliyor…" : "Ayarları kaydet"}
                </Button>
              </div>
            </CanWrite>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
