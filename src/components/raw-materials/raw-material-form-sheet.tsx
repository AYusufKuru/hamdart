"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
  FormField,
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import type { RawMaterialCategory } from "@/data/raw-materials";
import {
  createRawMaterial,
  RAW_MATERIAL_CATEGORIES,
  RAW_MATERIAL_UNITS,
} from "@/lib/raw-material-store";

function emptyForm() {
  return {
    sku: "",
    name: "",
    category: "Ham Madde" as RawMaterialCategory,
    unit: "kg",
    unitCost: "",
  };
}

interface RawMaterialFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function RawMaterialFormSheet({
  open,
  onOpenChange,
  onCreated,
}: RawMaterialFormSheetProps) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (open) setForm(emptyForm());
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const unitCost = parseFloat(form.unitCost);
    if (!form.sku.trim() || !form.name.trim()) {
      toast.error("SKU ve malzeme adı zorunludur");
      return;
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      toast.error("Birim maliyet 0 veya daha büyük olmalıdır");
      return;
    }

    try {
      const created = createRawMaterial({
        sku: form.sku,
        name: form.name,
        category: form.category,
        unit: form.unit,
        unitCost,
      });
      toast.success(`${created.name} tabloya eklendi`);
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kayıt eklenemedi");
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Hammadde Ekle"
      description="Reçete maliyetleri bu tablodaki birim maliyetlerden hesaplanır. SKU benzersiz olmalıdır."
    >
      <form className="flex flex-1 flex-col min-h-0" noValidate onSubmit={handleSubmit}>
        <FormSheetBody>
          <FormField
            label="SKU"
            htmlFor="rm-sku"
            hint="Tablodaki SKU sütunu — reçete ve tedarik siparişinde aynı kod kullanılır."
          >
            <Input
              id="rm-sku"
              required
              className="font-mono"
              placeholder="Örn: RM-API-CM"
              value={form.sku}
              onChange={(e) =>
                setForm((f) => ({ ...f, sku: e.target.value }))
              }
            />
          </FormField>

          <FormField label="Malzeme" htmlFor="rm-name">
            <Input
              id="rm-name"
              required
              placeholder="Örn: CardioMax API"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Kategori">
              <Select
                value={form.category}
                onValueChange={(category) =>
                  setForm((f) => ({
                    ...f,
                    category: category as RawMaterialCategory,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RAW_MATERIAL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Birim">
              <Select
                value={form.unit}
                onValueChange={(unit) => setForm((f) => ({ ...f, unit }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RAW_MATERIAL_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField
            label="Birim Maliyet (₺)"
            htmlFor="rm-cost"
            hint="Reçete satır maliyeti = birim maliyet × ihtiyaç miktarı."
          >
            <Input
              id="rm-cost"
              type="number"
              required
              min={0}
              step="0.01"
              placeholder="12500"
              value={form.unitCost}
              onChange={(e) =>
                setForm((f) => ({ ...f, unitCost: e.target.value }))
              }
            />
          </FormField>
        </FormSheetBody>

        <FormSheetFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            İptal
          </Button>
          <Button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
          >
            Malzemeyi Ekle
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
