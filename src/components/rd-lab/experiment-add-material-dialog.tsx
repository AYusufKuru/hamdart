"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog, FormField } from "@/components/shared/form-sheet";
import { SearchableSelect } from "@/components/shared/searchable-select";
import type { LabExperiment } from "@/data/mock";
import { addExperimentMaterial } from "@/lib/lab-store";
import { getAllWarehouseStockItems } from "@/lib/stock-store";
import { getWarehouseName, type WarehouseStockItem } from "@/data/warehouses";
import { ifAllowed } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import { formatNumber } from "@/lib/utils";

function isMamul(item: WarehouseStockItem) {
  return (
    item.category.trim().toLocaleLowerCase("tr").replace(/[İIıi]/g, "i") ===
    "mamul"
  );
}

export function ExperimentAddMaterialDialog({
  open,
  experiment,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  experiment: LabExperiment | null;
  onOpenChange: (open: boolean) => void;
  onAdded?: (experiment: LabExperiment) => void;
}) {
  const { canRead } = useAuth();
  const [stockItemId, setStockItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [stockItems, setStockItems] = useState<WarehouseStockItem[]>([]);
  const [saving, setSaving] = useState(false);

  const materialStock = useMemo(
    () =>
      stockItems
        .filter((item) => item.quantity > 0 && !isMamul(item))
        .sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [stockItems]
  );
  const selected = materialStock.find((s) => s.id === stockItemId);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setStockItemId("");
    setQuantity("");
    setReason("");
    void (async () => {
      const stock = await ifAllowed(
        canRead("stock"),
        () => getAllWarehouseStockItems(),
        [] as WarehouseStockItem[]
      );
      setStockItems(stock);
    })();
  }, [open, canRead]);

  async function submit() {
    if (!experiment) return;
    const qty = parseFloat(quantity.replace(",", "."));
    if (!stockItemId || !Number.isFinite(qty) || qty <= 0) {
      toast.error("Hammadde ve miktar gerekli");
      return;
    }
    if (!reason.trim()) {
      toast.error("Ekleme sebebini yazın");
      return;
    }
    if (selected && qty > selected.quantity) {
      toast.error(
        `En fazla ${formatNumber(selected.quantity)} ${selected.unit} alınabilir`
      );
      return;
    }
    setSaving(true);
    try {
      const updated = await addExperimentMaterial(experiment.id, {
        stockItemId,
        quantity: qty,
        reason: reason.trim(),
      });
      toast.success("Hammadde eklendi ve stoktan düşüldü");
      onOpenChange(false);
      onAdded?.(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eklenemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onOpenChange(false);
      }}
      icon={FlaskConical}
      title="Hammadde ekle"
      description={
        experiment
          ? `${experiment.code} · ${experiment.productName ?? experiment.title}`
          : undefined
      }
      className="max-w-md"
    >
      <div className="space-y-4 px-5 py-4">
        <FormField label="Hammadde" required>
          {materialStock.length > 0 ? (
            <SearchableSelect
              value={stockItemId || undefined}
              onValueChange={setStockItemId}
              placeholder="Stoktan seçin"
              searchPlaceholder="Hammadde ara…"
              emptyText="Eşleşen hammadde yok"
              options={materialStock.map((item) => ({
                value: item.id,
                label: `${item.name} · ${item.lotNo} · ${getWarehouseName(item.warehouseId)} (${formatNumber(item.quantity)} ${item.unit})`,
                keywords: `${item.name} ${item.lotNo} ${getWarehouseName(item.warehouseId)}`,
              }))}
            />
          ) : (
            <p className="text-sm text-amber-700">Uygun hammadde stoğu yok.</p>
          )}
        </FormField>
        <FormField
          label="Miktar"
          htmlFor="exp-add-qty"
          required
          hint={selected ? selected.unit : undefined}
        >
          <Input
            id="exp-add-qty"
            type="number"
            min={0.0001}
            step="any"
            className="bg-white"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </FormField>
        <FormField label="Ekleme sebebi" htmlFor="exp-add-reason" required>
          <Textarea
            id="exp-add-reason"
            value={reason}
            placeholder="Örn: Viskozite düşük, bağlayıcı artırıldı"
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
      </div>
      <div className="flex justify-end gap-2 border-t px-5 py-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={saving}
          onClick={() => onOpenChange(false)}
        >
          Vazgeç
        </Button>
        <Button
          type="button"
          className="rounded-xl"
          disabled={saving}
          onClick={() => void submit()}
        >
          Stoktan düş ve ekle
        </Button>
      </div>
    </FormDialog>
  );
}
