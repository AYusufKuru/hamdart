"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { completeLabExperiment } from "@/lib/lab-store";
import { formatDate, formatNumber } from "@/lib/utils";

export function ExperimentCompleteDialog({
  open,
  experiment,
  onOpenChange,
  onCompleted,
}: {
  open: boolean;
  experiment: LabExperiment | null;
  onOpenChange: (open: boolean) => void;
  onCompleted?: (experiment: LabExperiment) => void;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => {
    const map = new Map<
      string,
      { materialName: string; unit: string; quantity: number }
    >();
    for (const u of experiment?.materialUsages ?? []) {
      const key = `${u.materialName}|${u.unit}`;
      const prev = map.get(key);
      if (prev) prev.quantity += u.quantity;
      else {
        map.set(key, {
          materialName: u.materialName,
          unit: u.unit,
          quantity: u.quantity,
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      a.materialName.localeCompare(b.materialName, "tr")
    );
  }, [experiment]);

  const usages = experiment?.materialUsages ?? [];
  const alreadyDone = experiment?.status === "approved" && Boolean(experiment.recipeId);

  async function submit() {
    if (!experiment) return;
    setSaving(true);
    try {
      const updated = await completeLabExperiment(experiment.id, {
        completionNote: note.trim() || undefined,
      });
      toast.success(
        `Reçete oluşturuldu: ${updated.recipeCode ?? updated.productName}`
      );
      onOpenChange(false);
      setNote("");
      onCompleted?.(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tamamlanamadı");
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
      icon={ClipboardList}
      title={alreadyDone ? "Deney özeti" : "Deneyi tamamla"}
      description={
        experiment
          ? `${experiment.code} · ${experiment.productName ?? experiment.title} · ${experiment.recipeCode ?? "—"}`
          : undefined
      }
      className="max-w-2xl"
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div className="rounded-xl bg-muted/40 p-4 text-sm">
          <p className="font-semibold">Oluşturulacak reçete</p>
          <p className="mt-1 text-muted-foreground">
            Ürün: <span className="font-medium text-foreground">{experiment?.productName}</span>
            {" · "}
            Kod:{" "}
            <span className="font-mono font-medium text-foreground">
              {experiment?.recipeCode}
            </span>
          </p>
          {experiment?.completionNote ? (
            <p className="mt-2 text-muted-foreground">
              Not: {experiment.completionNote}
            </p>
          ) : null}
        </div>

        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Toplam harcanan hammadde
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hammadde</TableHead>
                <TableHead className="text-right">Toplam</TableHead>
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

        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Kullanım kayıtları ve notlar
          </p>
          <div className="space-y-2">
            {usages.map((u) => (
              <div
                key={u.id}
                className="rounded-xl border px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{u.materialName}</span>
                  <Badge variant={u.kind === "extra" ? "warning" : "info"}>
                    {u.kind === "extra" ? "Ek" : "Başlangıç"}
                  </Badge>
                  <span className="font-bold">
                    {formatNumber(u.quantity)} {u.unit}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(u.addedAt)} · {u.lotNo}
                  </span>
                </div>
                {u.reason ? (
                  <p className="mt-1 text-muted-foreground">{u.reason}</p>
                ) : null}
              </div>
            ))}
            {usages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kayıt yok</p>
            ) : null}
          </div>
        </div>

        {!alreadyDone ? (
          <FormField label="Tamamlama notu" htmlFor="exp-complete-note" optional>
            <Textarea
              id="exp-complete-note"
              value={note}
              disabled={saving}
              placeholder="Formülasyon sonucu, gözlemler…"
              onChange={(e) => setNote(e.target.value)}
            />
          </FormField>
        ) : null}
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t bg-background px-5 py-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={saving}
          onClick={() => onOpenChange(false)}
        >
          Kapat
        </Button>
        {!alreadyDone ? (
          <Button
            type="button"
            className="rounded-xl"
            disabled={saving || totals.length === 0}
            onClick={() => void submit()}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Reçeteyi oluştur ve tamamla
          </Button>
        ) : null}
      </div>
    </FormDialog>
  );
}
