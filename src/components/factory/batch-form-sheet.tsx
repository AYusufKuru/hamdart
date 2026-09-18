"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Play } from "lucide-react";
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
import { type BatchStatus, type ProductionBatch, type ProductionLine } from "@/data/mock";
import { capitalizeWordsTr, formatNumber, plusDaysIso, selectItemValues, todayIso } from "@/lib/utils";
import {
  BATCH_STATUS_OPTIONS,
  BATCH_UNITS,
  createProductionBatch,
  getAllProductionBatches,
  getAllProductionLines,
  lineHasActiveBatch,
  nextBatchNo,
  queuedBatchesForLine,
  suggestUnit,
} from "@/lib/production-store";
import { getAllRecipes } from "@/lib/recipe-store";
import {
  estimateRecipeMaterials,
  findRecipeByProductName,
} from "@/lib/recipe-calculations";
import type { Recipe } from "@/data/recipes";

const LINE_STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  idle: "Boşta",
  maintenance: "Bakımda",
  alert: "Uyarı",
};

const LINE_STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-500",
  idle: "bg-slate-400",
  maintenance: "bg-amber-500",
  alert: "bg-rose-500",
};

const BATCH_STATUS_META: {
  value: BatchStatus;
  label: string;
  hint: string;
  color: string;
}[] = [
  { value: "planned", label: "Planlandı", hint: "Henüz üretime alınmadı", color: "bg-slate-400" },
  { value: "in_progress", label: "Üretimde", hint: "Hat boşsa hemen başlar; meşgulse sıraya alınır", color: "bg-indigo-500" },
  { value: "queued", label: "Sırada", hint: "Hat boşalınca sıradaki işe geçer", color: "bg-violet-500" },
  { value: "qc_pending", label: "KK bekliyor", hint: "Kalite kontrol sonucu bekleniyor", color: "bg-amber-500" },
  { value: "completed", label: "Tamamlandı", hint: "Üretim bitti", color: "bg-emerald-500" },
  { value: "rejected", label: "Reddedildi", hint: "Parti serbest bırakılmaz", color: "bg-rose-500" },
];

function emptyForm(lines: ProductionLine[]) {
  const preferred =
    lines.find((l) => l.status === "idle") ??
    lines.find((l) => l.status === "active") ??
    lines[0];
  const lineName = preferred?.name ?? "";
  const product =
    preferred?.product && preferred.product !== "-" ? preferred.product : "";
  return {
    batchNo: "",
    product,
    line: lineName,
    status: "in_progress" as BatchStatus,
    quantity: "",
    unit: suggestUnit(product, lineName),
    startDate: todayIso(),
    endDate: plusDaysIso(2),
    yield: "0",
    qcScore: "0",
  };
}

interface BatchFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function BatchFormSheet({
  open,
  onOpenChange,
  onCreated,
}: BatchFormSheetProps) {
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => emptyForm([]));

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    void (async () => {
      const [allLines, recipeList, allBatches] = await Promise.all([
        getAllProductionLines(),
        getAllRecipes(),
        getAllProductionBatches(),
      ]);
      const recipeProducts = selectItemValues(
        recipeList.map((r) => r.productName)
      );
      setLines(allLines);
      setRecipes(recipeList);
      setProducts(recipeProducts);
      setBatches(allBatches);
      const formData = emptyForm(allLines);
      if (formData.line) {
        formData.batchNo = await nextBatchNo(formData.line);
      }
      if (!recipeProducts.includes(formData.product.trim())) {
        formData.product = "";
      }
      setForm(formData);
    })();
  }, [open]);

  const selectedLine = lines.find((l) => l.name === form.line);
  const lineBusy = lineHasActiveBatch(batches, form.line);
  const lineQueue = queuedBatchesForLine(batches, form.line);
  const willQueue =
    form.status === "queued" || (form.status === "in_progress" && lineBusy);
  const productOptions = products;
  const qtyPreview = parseFloat(form.quantity.replace(",", "."));
  const selectedRecipe = findRecipeByProductName(recipes, form.product);
  const estimatedMaterials =
    selectedRecipe && Number.isFinite(qtyPreview) && qtyPreview > 0
      ? estimateRecipeMaterials(selectedRecipe, qtyPreview)
      : [];
  const statusMeta =
    BATCH_STATUS_META.find((s) => s.value === form.status) ?? BATCH_STATUS_META[1];

  function applyLine(lineName: string) {
    const line = lines.find((l) => l.name === lineName);
    const lineProduct =
      line?.product && line.product !== "-" ? line.product : "";
    void nextBatchNo(lineName).then((batchNo) =>
      setForm((f) => {
        const product = products.includes(lineProduct)
          ? lineProduct
          : products.includes(f.product)
            ? f.product
            : "";
        return {
          ...f,
          line: lineName,
          product,
          batchNo,
          unit: suggestUnit(product, lineName),
        };
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const quantity = parseFloat(form.quantity);
    const yieldValue = parseFloat(form.yield);
    const qcScore = parseFloat(form.qcScore);

    if (!form.product.trim() || !form.line) {
      toast.error("Ürün ve hat zorunludur");
      return;
    }
    if (!products.includes(form.product.trim())) {
      toast.error("Ürün, kayıtlı bir reçeteden seçilmelidir");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Miktar 0'dan büyük olmalıdır");
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error("Bitiş tarihi başlangıçtan önce olamaz");
      return;
    }
    if (!Number.isFinite(yieldValue) || yieldValue < 0 || yieldValue > 100) {
      toast.error("Verim 0–100 arasında olmalıdır");
      return;
    }
    if (!Number.isFinite(qcScore) || qcScore < 0 || qcScore > 100) {
      toast.error("KK skoru 0–100 arasında olmalıdır");
      return;
    }

    if (selectedLine?.status === "maintenance") {
      toast.warning("Seçilen hat bakımda — batch yine de kaydedildi");
    }

    setSaving(true);
    try {
      const created = await createProductionBatch({
        batchNo: form.batchNo,
        product: capitalizeWordsTr(form.product),
        line: form.line,
        status: form.status,
        quantity,
        unit: form.unit,
        startDate: form.startDate,
        endDate: form.endDate,
        yield: yieldValue,
        qcScore,
      });

      toast.success(
        created.status === "queued"
          ? `${created.batchNo} sıraya alındı (${created.queuePosition}. sıra)`
          : `${created.batchNo} başlatıldı`
      );
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Play}
      title="Yeni batch başlat"
      description="Hat seçilince batch numarası otomatik gelir. Hat meşgulse yeni iş sıraya alınır."
      className="max-w-2xl"
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        noValidate
        onSubmit={handleSubmit}
      >
        <FormSheetBody className="space-y-5">
          <FormSection
            title="Hangi hat?"
            description="Boştaki hatlar önerilir. Aynı hatta ikinci iş otomatik sıraya girer."
          >
            <FormField label="Üretim hattı" htmlFor="batch-line" required>
              <Select
                value={form.line || undefined}
                onValueChange={applyLine}
              >
                <SelectTrigger id="batch-line" className="bg-white">
                  <SelectValue placeholder="Hat seçin" />
                </SelectTrigger>
                <SelectContent>
                  {lines
                    .filter((l) => l.name.trim())
                    .map((l) => (
                    <SelectItem key={l.id} value={l.name}>
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${LINE_STATUS_COLOR[l.status] ?? "bg-slate-400"}`}
                          aria-hidden
                        />
                        {l.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {selectedLine ? (
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Durum:{" "}
                <span className="font-semibold text-foreground">
                  {LINE_STATUS_LABEL[selectedLine.status] ?? selectedLine.status}
                </span>
                {" · "}
                Mevcut batch:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {selectedLine.currentBatch === "-"
                    ? "yok"
                    : selectedLine.currentBatch}
                </span>
                {lineQueue.length > 0 ? ` · sırada ${lineQueue.length}` : ""}
              </p>
            ) : null}
            {willQueue ? (
              <p className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3 py-2 text-[12px] leading-relaxed text-indigo-800">
                {lineBusy
                  ? `Bu hat meşgul. Kayıt hemen başlamaz; sıraya alınır (${lineQueue.length + 1}. sıra).`
                  : "Kayıt sıraya alınacak; hat boşalınca başlar."}
              </p>
            ) : null}
          </FormSection>

          <FormSection
            title="Ürün ve miktar"
            description="Ürün listesi reçetelerden gelir. Batch no hatta göre üretilir; gerekirse düzenleyebilirsiniz."
          >
            <FormField label="Batch no" htmlFor="batch-no" required>
              <Input
                id="batch-no"
                required
                className="bg-white font-mono"
                value={form.batchNo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, batchNo: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Ürün" htmlFor="batch-product" required>
              <Select
                value={form.product || undefined}
                onValueChange={(product) =>
                  setForm((f) => ({
                    ...f,
                    product,
                    unit: suggestUnit(product, f.line),
                  }))
                }
                disabled={productOptions.length === 0}
              >
                <SelectTrigger id="batch-product" className="bg-white">
                  <SelectValue
                    placeholder={
                      productOptions.length > 0
                        ? "Reçetedeki ürünü seçin"
                        : "Önce reçete ekleyin"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Miktar" htmlFor="batch-qty" required>
                <Input
                  id="batch-qty"
                  className="bg-white"
                  type="number"
                  required
                  min={1}
                  step="any"
                  inputMode="numeric"
                  placeholder="500000"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, quantity: e.target.value }))
                  }
                />
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
                    {BATCH_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            {form.product && Number.isFinite(qtyPreview) && qtyPreview > 0 ? (
              <div className="rounded-xl border bg-slate-50 px-3 py-3">
                <p className="mb-2 text-[12px] font-semibold text-foreground">
                  Tahmini hammadde (reçete × {formatNumber(qtyPreview)} {form.unit})
                </p>
                {estimatedMaterials.length > 0 ? (
                  <ul className="space-y-1 text-[13px]">
                    {estimatedMaterials.map((line) => (
                      <li
                        key={`${line.materialName}-${line.unit}`}
                        className="flex justify-between gap-3"
                      >
                        <span>{line.materialName}</span>
                        <span className="font-mono font-semibold">
                          {formatNumber(line.estimated)} {line.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] text-muted-foreground">
                    Bu reçetede miktarlı hammadde satırı yok.
                  </p>
                )}
              </div>
            ) : null}
          </FormSection>

          <FormSection
            title="Plan"
            description="Yeni kayıt için durum genellikle Üretimde bırakılır."
          >
            <FormField label="Durum" hint={statusMeta.hint}>
              <Select
                value={form.status}
                onValueChange={(status) =>
                  setForm((f) => ({ ...f, status: status as BatchStatus }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BATCH_STATUS_OPTIONS.map((s) => {
                    const meta = BATCH_STATUS_META.find((m) => m.value === s.value);
                    return (
                      <SelectItem key={s.value} value={s.value}>
                        <span className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${meta?.color ?? "bg-slate-400"}`}
                            aria-hidden
                          />
                          {s.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Başlangıç" htmlFor="batch-start" required>
                <Input
                  id="batch-start"
                  className="bg-white"
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Bitiş" htmlFor="batch-end" required>
                <Input
                  id="batch-end"
                  className="bg-white"
                  type="date"
                  required
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endDate: e.target.value }))
                  }
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Kalite"
            description="Yeni üretimde 0 bırakılabilir. KK skoru 0 ise listede — görünür."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Verim" htmlFor="batch-yield">
                <div className="relative">
                  <Input
                    id="batch-yield"
                    className="bg-white pr-8"
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    inputMode="decimal"
                    value={form.yield}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, yield: e.target.value }))
                    }
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                    %
                  </span>
                </div>
              </FormField>
              <FormField label="KK skoru" htmlFor="batch-qc">
                <div className="relative">
                  <Input
                    id="batch-qc"
                    className="bg-white pr-8"
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    inputMode="decimal"
                    value={form.qcScore}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, qcScore: e.target.value }))
                    }
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                    %
                  </span>
                </div>
              </FormField>
            </div>
          </FormSection>
        </FormSheetBody>

        <FormSheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving || !form.line}>
            {saving ? "Kaydediliyor…" : willQueue ? "Sıraya al" : "Batch’i başlat"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
