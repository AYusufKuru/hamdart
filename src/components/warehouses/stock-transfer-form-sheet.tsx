"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import type { Warehouse, WarehouseStockItem } from "@/data/warehouses";
import { createStockTransfer } from "@/lib/warehouse-store";

const REASON_OPTIONS = [
  { value: "manual", label: "Manuel" },
  { value: "replenishment", label: "Ana depodan aktarım" },
  { value: "direct_lab", label: "Doğrudan lab girişi" },
] as const;

type TransferForm = {
  sourceItemId: string;
  toWarehouseId: string;
  quantity: string;
  reason: (typeof REASON_OPTIONS)[number]["value"];
  note: string;
};

function emptyForm(fromWarehouseId?: string, items: WarehouseStockItem[] = []): TransferForm {
  const first = fromWarehouseId
    ? items.find((item) => item.warehouseId === fromWarehouseId)
    : items[0];
  return {
    sourceItemId: first?.id ?? "",
    toWarehouseId: "",
    quantity: first ? String(first.quantity) : "",
    reason: "manual",
    note: "",
  };
}

interface StockTransferFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouses: Warehouse[];
  items: WarehouseStockItem[];
  defaultFromWarehouseId?: string;
  onCreated?: () => void;
}

export function StockTransferFormSheet({
  open,
  onOpenChange,
  warehouses,
  items,
  defaultFromWarehouseId,
  onCreated,
}: StockTransferFormSheetProps) {
  const [form, setForm] = useState(() => emptyForm(defaultFromWarehouseId, items));
  const [saving, setSaving] = useState(false);

  const sourceItems = useMemo(
    () =>
      defaultFromWarehouseId
        ? items.filter((item) => item.warehouseId === defaultFromWarehouseId)
        : items,
    [items, defaultFromWarehouseId]
  );

  const source = sourceItems.find((item) => item.id === form.sourceItemId);
  const destOptions = warehouses.filter(
    (w) => w.id !== source?.warehouseId
  );

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(defaultFromWarehouseId, items));
  }, [open, defaultFromWarehouseId, items]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const quantity = Number(form.quantity);
    if (!form.sourceItemId) {
      toast.error("Kaynak stok kalemi seçin");
      return;
    }
    if (!form.toWarehouseId) {
      toast.error("Hedef depo seçin");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Pozitif bir miktar girin");
      return;
    }
    setSaving(true);
    try {
      await createStockTransfer({
        sourceItemId: form.sourceItemId,
        toWarehouseId: form.toWarehouseId,
        quantity,
        reason: form.reason,
        note: form.note.trim() || undefined,
      });
      toast.success("Stok aktarıldı");
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Aktarım yapılamadı");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Stok Aktar"
      description="Kaynak depodaki miktar düşer, hedef depoda aynı SKU ve lot varsa artar."
    >
      <form className="flex h-full min-h-0 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody>
          <FormField label="Kaynak kalem">
            <Select
              value={form.sourceItemId}
              onValueChange={(sourceItemId) => {
                const next = sourceItems.find((item) => item.id === sourceItemId);
                setForm((f) => ({
                  ...f,
                  sourceItemId,
                  quantity: next ? String(next.quantity) : f.quantity,
                  toWarehouseId:
                    f.toWarehouseId === next?.warehouseId ? "" : f.toWarehouseId,
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Stok kalemi seçin" />
              </SelectTrigger>
              <SelectContent>
                {sourceItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · {item.quantity} {item.unit} · {item.lotNo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Hedef depo">
            <Select
              value={form.toWarehouseId}
              onValueChange={(toWarehouseId) =>
                setForm((f) => ({ ...f, toWarehouseId }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Hedef depo" />
              </SelectTrigger>
              <SelectContent>
                {destOptions.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="Miktar"
            hint={
              source
                ? `En fazla ${source.quantity} ${source.unit}`
                : undefined
            }
          >
            <Input
              type="number"
              min={0}
              step="any"
              required
              value={form.quantity}
              onChange={(e) =>
                setForm((f) => ({ ...f, quantity: e.target.value }))
              }
            />
          </FormField>

          <FormField label="Tür">
            <Select
              value={form.reason}
              onValueChange={(reason) =>
                setForm((f) => ({
                  ...f,
                  reason: reason as TransferForm["reason"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Not">
            <Textarea
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={3}
            />
          </FormField>
        </FormSheetBody>
        <FormSheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving || sourceItems.length === 0}>
            {saving ? "Aktarılıyor…" : "Aktar"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
