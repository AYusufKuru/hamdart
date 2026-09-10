"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FlaskConical } from "lucide-react";
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
    category: "Kimyasal" as RawMaterialCategory,
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSaving(false);
      setForm(emptyForm());
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
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

    setSaving(true);
    try {
      const created = await createRawMaterial({
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={FlaskConical}
      title="Yeni hammadde"
      description="Reçete maliyetleri bu tablodaki birim maliyetlerden hesaplanır. SKU benzersiz olmalıdır."
    >
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection
            title="Kimlik"
            description="SKU reçete ve tedarik siparişinde aynı kodla kullanılır."
          >
            <FormField label="SKU" htmlFor="rm-sku" required>
              <Input
                id="rm-sku"
                required
                className="bg-white font-mono"
                placeholder="Örn: 150.02.01.00340"
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              />
            </FormField>
            <FormField label="Malzeme adı" htmlFor="rm-name" required>
              <Input
                id="rm-name"
                required
                className="bg-white"
                placeholder="Örn: Avicel 102"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </FormField>
          </FormSection>

          <FormSection title="Sınıflandırma">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Kategori" required>
                <Select
                  value={form.category}
                  onValueChange={(category) =>
                    setForm((f) => ({
                      ...f,
                      category: category as RawMaterialCategory,
                    }))
                  }
                >
                  <SelectTrigger className="bg-white">
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
              <FormField label="Birim" required>
                <Select
                  value={form.unit}
                  onValueChange={(unit) => setForm((f) => ({ ...f, unit }))}
                >
                  <SelectTrigger className="bg-white">
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
          </FormSection>

          <FormSection title="Maliyet">
            <FormField
              label="Birim maliyet"
              htmlFor="rm-cost"
              required
              hint="Reçete satır maliyeti = birim maliyet × ihtiyaç miktarı."
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  ₺
                </span>
                <Input
                  id="rm-cost"
                  type="number"
                  required
                  min={0}
                  step="0.01"
                  className="bg-white pl-8"
                  placeholder="12500"
                  value={form.unitCost}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, unitCost: e.target.value }))
                  }
                />
              </div>
            </FormField>
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
            {saving ? "Kaydediliyor…" : "Malzemeyi kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
