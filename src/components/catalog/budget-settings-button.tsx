"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormDialog,
  FormField,
  FormSection,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import type { BudgetCashDirection, BudgetCategory } from "@/data/catalog";
import {
  createBudgetCategory,
  deleteBudgetCategory,
  fetchBudgetCategories,
} from "@/lib/catalog-store";
import { budgetDirectionLabel } from "@/lib/budget-cash";

function CategoryColumn({
  title,
  direction,
  rows,
  writable,
  onChanged,
}: {
  title: string;
  direction: BudgetCashDirection;
  rows: BudgetCategory[];
  writable: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    const value = name.trim();
    if (!value) {
      toast.error("Çeşit adı girin");
      return;
    }
    setSaving(true);
    try {
      await createBudgetCategory({ direction, name: value });
      setName("");
      toast.success("Çeşit eklendi");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eklenemedi");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: BudgetCategory) {
    if (!window.confirm(`${row.name} silinsin mi? Kayıtlı hareketler durur.`)) return;
    try {
      await deleteBudgetCategory(row.id);
      toast.success("Çeşit silindi");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  return (
    <FormSection title={title} description={`${budgetDirectionLabel(direction)} eklerken bu listeden seçilir.`}>
      {writable ? (
        <FormField label="Yeni çeşit">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Kira"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void add();
                }
              }}
            />
            <Button type="button" onClick={() => void add()} disabled={saving} className="shrink-0">
              <Plus className="mr-1 h-4 w-4" />
              Ekle
            </Button>
          </div>
        </FormField>
      ) : null}
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz çeşit yok</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2"
            >
              <span className="text-sm font-medium">{row.name}</span>
              {writable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-rose-600"
                  onClick={() => void remove(row)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </FormSection>
  );
}

export function BudgetSettingsButton({
  writable,
  onChanged,
}: {
  writable: boolean;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<BudgetCategory[]>([]);

  const loadRows = useCallback(async () => {
    setRows(await fetchBudgetCategories());
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadRows().catch(() => setRows([]));
  }, [open, loadRows]);

  async function handleChanged() {
    await loadRows();
    onChanged?.();
  }

  const gelir = useMemo(() => rows.filter((row) => row.direction === "gelir"), [rows]);
  const gider = useMemo(() => rows.filter((row) => row.direction === "gider"), [rows]);

  return (
    <>
      <Button variant="outline" className="rounded-2xl" onClick={() => setOpen(true)}>
        <Settings className="mr-2 h-4 w-4" />
        Ayarlar
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        icon={Settings}
        title="Bütçe ayarları"
        description="Gelir ve gider çeşitlerini buradan ekleyin veya silin."
        className="max-w-3xl"
      >
        <FormSheetBody>
          <div className="grid gap-4 sm:grid-cols-2">
          <CategoryColumn
            title="Gelir çeşitleri"
            direction="gelir"
            rows={gelir}
            writable={writable}
            onChanged={() => void handleChanged()}
          />
          <CategoryColumn
            title="Gider çeşitleri"
            direction="gider"
            rows={gider}
            writable={writable}
            onChanged={() => void handleChanged()}
          />
          </div>
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Kapat
          </Button>
        </FormSheetFooter>
      </FormDialog>
    </>
  );
}
