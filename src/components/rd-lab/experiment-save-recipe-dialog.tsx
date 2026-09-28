"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormDialog, FormField } from "@/components/shared/form-sheet";
import type { LabExperiment } from "@/data/mock";
import { saveExperimentRecipe } from "@/lib/lab-store";
import { latestFormulaTotals } from "@/lib/lab-experiment-steps";
import { formatNumber } from "@/lib/utils";

export function ExperimentSaveRecipeDialog({
  open,
  experiment,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  experiment: LabExperiment | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (experiment: LabExperiment) => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !experiment) return;
    setName(experiment.productName?.trim() || experiment.title);
  }, [open, experiment]);

  const totals = useMemo(
    () => latestFormulaTotals(experiment?.materialUsages ?? []),
    [experiment]
  );

  async function submit() {
    if (!experiment) return;
    const productName = name.trim();
    if (!productName) {
      toast.error("Reçete adı zorunludur");
      return;
    }
    setSaving(true);
    try {
      const updated = await saveExperimentRecipe(experiment.id, { productName });
      toast.success(`Reçete kaydedildi: ${updated.recipeCode ?? productName}`);
      onOpenChange(false);
      onSaved?.(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reçete kaydedilemedi");
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
      icon={BookMarked}
      title="Reçetelere ekle"
      description={
        experiment
          ? `${experiment.code} · son adımdaki miktarlar reçeteye yazılır`
          : undefined
      }
      className="max-w-lg"
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <FormField label="Reçete adı" htmlFor="exp-recipe-name" required>
          <Input
            id="exp-recipe-name"
            value={name}
            disabled={saving}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Reçeteye gidecek miktar (son adım)
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hammadde</TableHead>
                <TableHead className="text-right">Miktar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {totals.map((row) => (
                <TableRow key={`${row.materialName}-${row.unit}`}>
                  <TableCell className="font-medium">{row.materialName}</TableCell>
                  <TableCell className="text-right font-bold">
                    {formatNumber(row.quantity)} {row.unit}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t bg-background px-5 py-3">
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
          disabled={saving || !name.trim() || totals.length === 0}
          onClick={() => void submit()}
        >
          <BookMarked className="mr-2 h-4 w-4" />
          Reçetelere kaydet
        </Button>
      </div>
    </FormDialog>
  );
}
