"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import { getAllRawMaterials } from "@/lib/raw-material-store";
import { createRecipe, getAllRecipes, nextRecipeCode } from "@/lib/recipe-store";
import { fetchProducts } from "@/lib/catalog-store";

type Line = { materialName: string; unit: string; quantity: string };

function emptyForm() {
  return {
    code: "",
    productCode: "",
    productName: "",
    lines: [{ materialName: "", unit: "mg", quantity: "" }] as Line[],
  };
}

interface RecipeFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function RecipeFormSheet({
  open,
  onOpenChange,
  onCreated,
}: RecipeFormSheetProps) {
  const [form, setForm] = useState(emptyForm);
  const [materials, setMaterials] = useState<{ name: string; unit: string }[]>(
    []
  );
  const [productNames, setProductNames] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    void (async () => {
      const [materialList, recipes, products] = await Promise.all([
        getAllRawMaterials(),
        getAllRecipes(),
        fetchProducts(),
      ]);
      const byName = new Map<string, string>();
      for (const m of materialList) {
        if (m.name && !byName.has(m.name)) byName.set(m.name, m.unit);
      }
      setMaterials(
        [...byName.entries()]
          .map(([name, unit]) => ({ name, unit }))
          .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      );
      setProductNames(
        [
          ...new Set([
            ...recipes.map((r) => r.productName),
            ...products.map((p) => p.name),
          ]),
        ]
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "tr"))
      );
      const code = await nextRecipeCode();
      setForm((f) => ({ ...f, code }));
    })();
  }, [open]);

  function patchLine(index: number, patch: Partial<Line>) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => {
        if (i !== index) return l;
        const next = { ...l, ...patch };
        if (patch.materialName) {
          const hit = materials.find((m) => m.name === patch.materialName);
          if (hit) next.unit = hit.unit || next.unit;
        }
        return next;
      }),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const created = await createRecipe({
        code: form.code,
        productCode: form.productCode,
        productName: form.productName,
        lines: form.lines.map((l) => ({
          materialName: l.materialName,
          unit: l.unit,
          quantityPerUnit: parseFloat(l.quantity.replace(",", ".")) || 0,
        })),
      });
      toast.success(`${created.code} kaydedildi`);
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kayıt başarısız");
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Reçete Ekle"
      description="Excel yapısı: reçete kodu, ürün kodu, ürün adı ve hammadde satırları."
      className="sm:w-[40rem] sm:max-w-[40rem]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <FormSheetBody>
          <FormField label="Reçete Kodu" htmlFor="rec-code">
            <Input
              id="rec-code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </FormField>
          <FormField label="Ürün Kodu" htmlFor="rec-pcode">
            <Input
              id="rec-pcode"
              value={form.productCode}
              onChange={(e) =>
                setForm((f) => ({ ...f, productCode: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Ürün adı" htmlFor="rec-pname">
            <Input
              id="rec-pname"
              list="rec-product-names"
              value={form.productName}
              onChange={(e) =>
                setForm((f) => ({ ...f, productName: e.target.value }))
              }
              placeholder="Örn: Hepanorm 30 Tablet"
              required
            />
            <datalist id="rec-product-names">
              {productNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </FormField>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">Hammadde satırları</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    lines: [
                      ...f.lines,
                      { materialName: "", unit: "mg", quantity: "" },
                    ],
                  }))
                }
              >
                <Plus className="w-4 h-4 mr-1" />
                Satır
              </Button>
            </div>
            {form.lines.map((line, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_5rem_6rem_auto] gap-2 items-end"
              >
                <FormField
                  label={index === 0 ? "Hammadde adı" : ""}
                  htmlFor={`mat-${index}`}
                >
                  <Input
                    id={`mat-${index}`}
                    list="rec-material-names"
                    value={line.materialName}
                    onChange={(e) =>
                      patchLine(index, { materialName: e.target.value })
                    }
                    placeholder="Malzeme"
                  />
                </FormField>
                <FormField label={index === 0 ? "Birim" : ""} htmlFor={`unit-${index}`}>
                  <Input
                    id={`unit-${index}`}
                    value={line.unit}
                    onChange={(e) => patchLine(index, { unit: e.target.value })}
                  />
                </FormField>
                <FormField
                  label={index === 0 ? "Birim Miktar" : ""}
                  htmlFor={`qty-${index}`}
                >
                  <Input
                    id={`qty-${index}`}
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(e) =>
                      patchLine(index, { quantity: e.target.value })
                    }
                  />
                </FormField>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mb-0.5"
                  disabled={form.lines.length <= 1}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      lines: f.lines.filter((_, i) => i !== index),
                    }))
                  }
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <datalist id="rec-material-names">
              {materials.map((m) => (
                <option key={m.name} value={m.name} />
              ))}
            </datalist>
          </div>
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button
            type="submit"
            className="bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
          >
            Reçeteyi Kaydet
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
