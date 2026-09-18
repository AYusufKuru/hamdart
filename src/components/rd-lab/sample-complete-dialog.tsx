"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Recycle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog, FormField } from "@/components/shared/form-sheet";
import type { LabSample } from "@/data/mock";
import { completeLabSample } from "@/lib/lab-store";
import { formatNumber } from "@/lib/utils";

export function SampleCompleteDialog({
  open,
  sample,
  onOpenChange,
  onCompleted,
}: {
  open: boolean;
  sample: LabSample | null;
  onOpenChange: (open: boolean) => void;
  onCompleted?: (sample: LabSample) => void;
}) {
  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);

  async function finish(disposition: "returned" | "scrap") {
    if (!sample) return;
    setSaving(true);
    try {
      const updated = await completeLabSample(sample.id, {
        disposition,
        result: result.trim() || undefined,
      });
      toast.success(
        disposition === "returned"
          ? `${updated.sampleNo} depoya iade edildi`
          : `${updated.sampleNo} ıskarta olarak işaretlendi`
      );
      onOpenChange(false);
      setResult("");
      onCompleted?.(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem yapılamadı");
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
      title="Testi tamamla"
      description={
        sample
          ? `${sample.sampleNo} · ${sample.product} · ${formatNumber(sample.quantity ?? 0)} ${sample.unit ?? ""}`
          : undefined
      }
      className="max-w-md"
    >
      <div className="space-y-4 px-5 py-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Test bittikten sonra numuneyi stoğa geri verin veya ıskarta edin.
          Hammadde kendi deposuna, mamul mamul stoğa döner.
        </p>
        <FormField label="Sonuç notu" htmlFor="smp-complete-result" optional>
          <Textarea
            id="smp-complete-result"
            value={result}
            disabled={saving}
            placeholder="Test sonucu, red nedeni veya iade notu"
            onChange={(e) => setResult(e.target.value)}
          />
        </FormField>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-3">
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
          variant="outline"
          className="rounded-xl"
          disabled={saving || !sample}
          onClick={() => void finish("scrap")}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Iskarta
        </Button>
        <Button
          type="button"
          className="rounded-xl"
          disabled={saving || !sample}
          onClick={() => void finish("returned")}
        >
          <Recycle className="mr-2 h-4 w-4" />
          Depoya iade
        </Button>
      </div>
    </FormDialog>
  );
}
