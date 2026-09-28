"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Microscope, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormDialog,
  FormField,
  FormSection,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import { SearchableSelect } from "@/components/shared/searchable-select";
import {
  createLabExperiment,
  getLabExperimentMaterials,
  getLabPeople,
  nextExperimentCode,
  labMaterialTitle,
  type LabPickableMaterial,
} from "@/lib/lab-store";
import { nextRecipeCode } from "@/lib/recipe-store";
import { getWarehouseName } from "@/data/warehouses";
import { formatNumber, selectItemValues, todayIso } from "@/lib/utils";
import { PersonField } from "@/components/rd-lab/person-field";

type MaterialLine = {
  key: string;
  stockItemId: string;
  quantity: string;
};

function emptyForm() {
  return {
    code: "",
    productName: "",
    recipeCode: "",
    researcher: "",
    startDate: todayIso(),
    materials: [{ key: "m-0", stockItemId: "", quantity: "" }] as MaterialLine[],
  };
}

function materialLabel(item: LabPickableMaterial) {
  const title = labMaterialTitle(item);
  if (item.source === "lot") {
    return `${title} · ${item.lotNo} · ${getWarehouseName(item.warehouseId)} (${formatNumber(item.quantity)} ${item.unit})`;
  }
  return title === item.sku ? item.sku : `${title} · ${item.sku}`;
}

export function ExperimentFormSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [researchers, setResearchers] = useState<string[]>([]);
  const [materials, setMaterials] = useState<LabPickableMaterial[]>([]);

  const researcherOptions = useMemo(
    () => selectItemValues(researchers),
    [researchers]
  );

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setForm(emptyForm());
    void (async () => {
      const [people, catalog, expCode, recCode] = await Promise.all([
        getLabPeople("researcher").catch(() => [] as string[]),
        getLabExperimentMaterials().catch(() => [] as LabPickableMaterial[]),
        nextExperimentCode().catch(() => ""),
        nextRecipeCode().catch(() => "REC-001"),
      ]);
      setResearchers(selectItemValues(people));
      setMaterials(catalog);
      setForm((f) => ({
        ...f,
        code: expCode || f.code,
        recipeCode: recCode,
      }));
    })();
  }, [open]);

  function updateLine(key: string, patch: Partial<MaterialLine>) {
    setForm((f) => ({
      ...f,
      materials: f.materials.map((line) =>
        line.key === key ? { ...line, ...patch } : line
      ),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.productName.trim() || !form.recipeCode.trim()) {
      toast.error("Ürün adı ve reçete kodu zorunludur");
      return;
    }
    if (!form.researcher.trim()) {
      toast.error("Araştırmacı seçin");
      return;
    }
    const chosen: { stockItemId: string; quantity: number }[] = [];
    for (const line of form.materials) {
      if (!line.stockItemId) continue;
      const quantity = parseFloat(line.quantity.replace(",", "."));
      if (!Number.isFinite(quantity) || quantity <= 0) {
        toast.error("Her hammadde için geçerli miktar girin");
        return;
      }
      const item = materials.find((s) => s.id === line.stockItemId);
      if (item?.source === "lot" && quantity > item.quantity) {
        toast.error(
          `${item.name}: en fazla ${formatNumber(item.quantity)} ${item.unit}`
        );
        return;
      }
      chosen.push({ stockItemId: line.stockItemId, quantity });
    }
    if (chosen.length === 0) {
      toast.error("En az bir hammadde seçin");
      return;
    }

    setSaving(true);
    try {
      const created = await createLabExperiment({
        code: form.code,
        productName: form.productName,
        recipeCode: form.recipeCode,
        researcher: form.researcher,
        startDate: form.startDate,
        materials: chosen,
      });
      toast.success(
        `${created.code} başlatıldı — Adım 1 hammaddeleri kaydedildi`
      );
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deney kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Microscope}
      title="Yeni deney (reçete geliştirme)"
      description="Ürün ve reçete bilgisini girin, deneme formülasyonu için hammaddeleri seçin."
      className="max-w-2xl"
    >
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection title="Reçete bilgisi">
            <FormField label="Deney kodu" htmlFor="exp-code" required>
              <Input
                id="exp-code"
                required
                className="bg-white font-mono"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Ürün adı" htmlFor="exp-product" required>
                <Input
                  id="exp-product"
                  required
                  className="bg-white"
                  placeholder="Örn: DENEME-ÜRÜN-1"
                  value={form.productName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, productName: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Reçete kodu" htmlFor="exp-recipe" required>
                <Input
                  id="exp-recipe"
                  required
                  className="bg-white font-mono"
                  placeholder="REC-001"
                  value={form.recipeCode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, recipeCode: e.target.value }))
                  }
                />
              </FormField>
            </div>
            <PersonField
              id="exp-researcher"
              label="Araştırmacı"
              value={form.researcher}
              options={researcherOptions}
              onChange={(researcher) => setForm((f) => ({ ...f, researcher }))}
              placeholder="Araştırmacı seçin"
              emptyHint="Araştırmacı departmanında çalışan yok. Personel ekranından ekleyin."
            />
            <FormField label="Başlangıç" htmlFor="exp-start" required>
              <Input
                id="exp-start"
                type="date"
                required
                className="bg-white"
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Formülasyon hammaddeleri"
            description="Stok Durumu’ndaki ürünlerden seçin. Seçilen miktar o lotun stoğundan düşülür."
          >
            <div className="space-y-3">
              {form.materials.map((line, index) => {
                const selected = materials.find((s) => s.id === line.stockItemId);
                return (
                  <div
                    key={line.key}
                    className="grid grid-cols-1 gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_120px_40px]"
                  >
                    <FormField
                      label={index === 0 ? "Hammadde" : undefined}
                      required={index === 0}
                    >
                      <SearchableSelect
                        value={line.stockItemId || undefined}
                        onValueChange={(stockItemId) =>
                          updateLine(line.key, { stockItemId })
                        }
                        placeholder="Stoktan ürün seçin"
                        searchPlaceholder="Ürün, SKU veya lot ara…"
                        emptyText="Stokta eşleşen ürün yok"
                        options={materials.map((item) => ({
                          value: item.id,
                          label: materialLabel(item),
                          keywords: `${item.name} ${item.sku} ${item.lotNo}`,
                        }))}
                      />
                    </FormField>
                    <FormField
                      label={index === 0 ? "Miktar" : undefined}
                      required={index === 0}
                      hint={
                        selected
                          ? selected.source === "lot"
                            ? `${selected.unit} · stokta ${formatNumber(selected.quantity)}`
                            : selected.unit
                          : undefined
                      }
                    >
                      <Input
                        type="number"
                        min={0.0001}
                        step="any"
                        className="bg-white"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.key, { quantity: e.target.value })
                        }
                      />
                    </FormField>
                    <div className={index === 0 ? "pt-7" : "pt-1"}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="rounded-xl"
                        disabled={form.materials.length <= 1}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            materials: f.materials.filter(
                              (m) => m.key !== line.key
                            ),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {materials.length === 0 ? (
              <p className="text-sm text-amber-700">
                Stok Durumu’nda miktarı olan ürün yok.
              </p>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    materials: [
                      ...f.materials,
                      {
                        key: `m-${Date.now()}`,
                        stockItemId: "",
                        quantity: "",
                      },
                    ],
                  }))
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Hammadde satırı
              </Button>
            )}
          </FormSection>
        </FormSheetBody>

        <FormSheetFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Vazgeç
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
          >
            {saving ? "Kaydediliyor…" : "Deneyi başlat"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
