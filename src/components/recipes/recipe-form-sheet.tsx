"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormDialog,
  FormField,
  FormSection,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import type { Recipe } from "@/data/recipes";
import { getAllRawMaterials } from "@/lib/raw-material-store";
import {
  createRecipe,
  nextRecipeCode,
  updateRecipe,
} from "@/lib/recipe-store";
import { capitalizeWordsTr, selectItemValues } from "@/lib/utils";

const LINE_UNITS = ["mg", "g", "kg", "adet", "mL", "L"] as const;

type Line = { materialName: string; unit: string; quantity: string };

function emptyForm() {
  return {
    code: "",
    productCode: "",
    productName: "",
    lines: [{ materialName: "", unit: "mg", quantity: "" }] as Line[],
  };
}

function formFromRecipe(recipe: Recipe) {
  return {
    code: recipe.code ?? "",
    productCode: recipe.productCode ?? "",
    productName: recipe.productName ?? "",
    lines:
      recipe.lines.length > 0
        ? recipe.lines.map((l) => ({
            materialName: l.materialName ?? "",
            unit: l.unit || "mg",
            quantity:
              l.quantityPerUnit > 0 ? String(l.quantityPerUnit) : "",
          }))
        : [{ materialName: "", unit: "mg", quantity: "" }],
  };
}

export function RecipeFormSheet({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Recipe | null;
  onSaved?: (recipe: Recipe) => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [materials, setMaterials] = useState<{ name: string; unit: string }[]>(
    []
  );
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(editing);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    void (async () => {
      const materialList = await getAllRawMaterials();
      const byName = new Map<string, string>();
      for (const m of materialList) {
        if (m.name && !byName.has(m.name)) byName.set(m.name, m.unit);
      }
      setMaterials(
        [...byName.entries()]
          .map(([name, unit]) => ({ name, unit }))
          .filter((m) => m.name.trim())
          .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      );
      if (editing) {
        setForm(formFromRecipe(editing));
      } else {
        const code = await nextRecipeCode();
        setForm({ ...emptyForm(), code });
      }
    })();
  }, [open, editing]);

  const validLineCount = form.lines.filter(
    (l) => l.materialName.trim() && parseFloat(l.quantity.replace(",", ".")) > 0
  ).length;

  function patchLine(index: number, patch: Partial<Line>) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => {
        if (i !== index) return l;
        const next = { ...l, ...patch };
        if (patch.materialName) {
          const hit = materials.find((m) => m.name === patch.materialName);
          if (hit?.unit) next.unit = hit.unit;
        }
        return next;
      }),
    }));
  }

  function addLine() {
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { materialName: "", unit: "mg", quantity: "" }],
    }));
  }

  function removeLine(index: number) {
    setForm((f) => ({
      ...f,
      lines: f.lines.filter((_, i) => i !== index),
    }));
  }

  function materialOptionsFor(line: Line) {
    const named = materials.filter((m) => m.name.trim());
    if (
      line.materialName.trim() &&
      !named.some((m) => m.name === line.materialName)
    ) {
      return [{ name: line.materialName, unit: line.unit }, ...named];
    }
    return named;
  }

  function unitOptionsFor(line: Line) {
    const fromMaterial = materials.find((m) => m.name === line.materialName)?.unit;
    const base = new Set<string>(LINE_UNITS);
    if (fromMaterial?.trim()) base.add(fromMaterial);
    if (line.unit.trim()) base.add(line.unit);
    return selectItemValues(base);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.productName.trim()) {
      toast.error("Ürün adı zorunludur");
      return;
    }

    const parsedLines = form.lines
      .map((l) => ({
        materialName: l.materialName.trim(),
        unit: l.unit.trim() || "mg",
        quantityPerUnit: parseFloat(l.quantity.replace(",", ".")) || 0,
      }))
      .filter((l) => l.materialName && l.quantityPerUnit > 0);

    if (parsedLines.length === 0) {
      toast.error("En az bir geçerli hammadde satırı girin");
      return;
    }

    setSaving(true);
    try {
      const saved = editing
        ? await updateRecipe({
            id: editing.id,
            code: form.code.trim(),
            productCode: form.productCode.trim(),
            productName: capitalizeWordsTr(form.productName),
            lines: parsedLines,
            status: "saved",
          })
        : await createRecipe({
            code: form.code.trim(),
            productCode: form.productCode.trim(),
            productName: capitalizeWordsTr(form.productName),
            lines: parsedLines,
          });
      toast.success(
        isEdit
          ? `${saved.code || saved.productName} güncellendi`
          : `${saved.code || saved.productName} kaydedildi`
      );
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={ClipboardList}
      title={isEdit ? "Reçeteyi düzenle" : "Yeni reçete"}
      description={
        isEdit
          ? "Ürün bilgisi ve hammadde miktarlarını güncelleyin."
          : "Reçete kodu otomatik gelir. Hammaddeler 1 birim çıktı başına miktar olarak kaydedilir."
      }
      className="max-w-2xl"
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        noValidate
        onSubmit={handleSubmit}
      >
        <FormSheetBody className="space-y-5">
          <FormSection
            title="Reçete bilgisi"
            description="Ürün adını yazın. Batch başlatırken bu ad listede çıkar."
          >
            <FormField label="Reçete kodu" htmlFor="rec-code" optional>
              <Input
                id="rec-code"
                className="bg-white font-mono"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="REC-001"
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Ürün kodu" htmlFor="rec-pcode" optional>
                <Input
                  id="rec-pcode"
                  className="bg-white font-mono"
                  value={form.productCode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, productCode: e.target.value }))
                  }
                  placeholder="PRD-001"
                />
              </FormField>
              <FormField label="Ürün adı" htmlFor="rec-pname" required>
                <Input
                  id="rec-pname"
                  className="bg-white"
                  required
                  value={form.productName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, productName: e.target.value }))
                  }
                  placeholder="Örn. Hepanorm 30 Tablet"
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Hammadde satırları"
            description={`1 birim mamul için gereken miktar. ${validLineCount > 0 ? `${validLineCount} geçerli satır.` : "En az bir satır doldurun."}`}
          >
            <div className="space-y-2">
              {form.lines.map((line, index) => (
                <div
                  key={index}
                  className="relative grid grid-cols-1 gap-2 rounded-xl border bg-white p-3 sm:grid-cols-[1fr_5.5rem_6.5rem_auto]"
                >
                  <FormField
                    label={index === 0 ? "Hammadde" : ""}
                    htmlFor={`mat-${index}`}
                    required={index === 0}
                  >
                    {materials.length > 0 ? (
                      <Select
                        value={line.materialName || undefined}
                        onValueChange={(materialName) =>
                          patchLine(index, { materialName })
                        }
                      >
                        <SelectTrigger id={`mat-${index}`} className="bg-white">
                          <SelectValue placeholder="Malzeme seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {materialOptionsFor(line).map((m) => (
                            <SelectItem key={m.name} value={m.name}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={`mat-${index}`}
                        className="bg-white"
                        value={line.materialName}
                        onChange={(e) =>
                          patchLine(index, { materialName: e.target.value })
                        }
                        placeholder="Malzeme adı"
                      />
                    )}
                  </FormField>
                  <FormField label={index === 0 ? "Birim" : ""}>
                    <Select
                      value={line.unit || "mg"}
                      onValueChange={(unit) => patchLine(index, { unit })}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {unitOptionsFor(line).map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField
                    label={index === 0 ? "Miktar" : ""}
                    htmlFor={`qty-${index}`}
                    required={index === 0}
                  >
                    <Input
                      id={`qty-${index}`}
                      className="bg-white"
                      inputMode="decimal"
                      placeholder="0"
                      value={line.quantity}
                      onChange={(e) =>
                        patchLine(index, { quantity: e.target.value })
                      }
                    />
                  </FormField>
                  <div className={index === 0 ? "flex items-end pb-0.5" : "flex items-center"}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-rose-600"
                      disabled={form.lines.length <= 1}
                      aria-label="Satırı sil"
                      onClick={() => removeLine(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 w-full rounded-xl border-dashed sm:w-auto"
              onClick={addLine}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Hammadde satırı ekle
            </Button>
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
            disabled={saving || !form.productName.trim()}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
          >
            {saving
              ? "Kaydediliyor…"
              : isEdit
                ? "Değişiklikleri kaydet"
                : "Reçeteyi kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
