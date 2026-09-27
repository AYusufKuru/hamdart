"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, Check, Inbox, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FormDialog,
  FormField,
  FormSection,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import {
  getWarehouseName,
  isFinishedWarehouseType,
  transferStatusLabel,
  type StockTransfer,
  type Warehouse,
  type WarehouseStockItem,
} from "@/data/warehouses";
import {
  createTransferRequest,
  getTransferRequestOptions,
  respondTransferRequest,
} from "@/lib/warehouse-store";
import { useAuth } from "@/lib/auth/auth-context";
import {
  canRequestStockTransfer,
  canRespondTransferRequest,
  warehouseScope,
} from "@/lib/auth/permissions";
import { formatDate } from "@/lib/utils";

type RequestForm = {
  toWarehouseId: string;
  fromWarehouseId: string;
  sku: string;
  quantity: string;
  note: string;
};

const EMPTY_FORM: RequestForm = {
  toWarehouseId: "",
  fromWarehouseId: "",
  sku: "",
  quantity: "",
  note: "",
};

function statusVariant(status: string) {
  if (status === "rejected") return "danger" as const;
  return "warning" as const;
}

/** Mamul depoları arası transfer talepleri: talep oluşturma ve gönderen depoda yanıt */
export function TransferRequestsCard({
  warehouses,
  stock,
  transfers,
  focusWarehouseId,
  onChanged,
}: {
  warehouses: Warehouse[];
  /** Kullanıcının görebildiği stok (onayda lot seçimi için) */
  stock: WarehouseStockItem[];
  transfers: StockTransfer[];
  /** Depo detayında yalnızca bu depoyla ilgili talepler */
  focusWarehouseId?: string;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const scope = user ? warehouseScope(user) : null;
  const finished = useMemo(
    () => warehouses.filter((w) => isFinishedWarehouseType(w.type)),
    [warehouses]
  );
  const targetOptions = finished.filter(
    (w) =>
      (!scope || scope.includes(w.id)) &&
      (!focusWarehouseId || w.id === focusWarehouseId) &&
      Boolean(user && canRequestStockTransfer(user, w.id))
  );
  const canRequest = targetOptions.length > 0;

  const rows = transfers.filter(
    (t) =>
      t.reason === "finished_request" &&
      (!focusWarehouseId ||
        t.fromWarehouseId === focusWarehouseId ||
        t.toWarehouseId === focusWarehouseId)
  );

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RequestForm>(EMPTY_FORM);
  const [options, setOptions] = useState<{ sku: string; name: string; unit: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [approveTarget, setApproveTarget] = useState<StockTransfer | null>(null);
  const [lotId, setLotId] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const sourceOptions = finished.filter((w) => w.id !== form.toWarehouseId);
  const selectedOption = options.find((o) => o.sku === form.sku);

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_FORM, toWarehouseId: targetOptions[0]?.id ?? "" });
    setOptions([]);
    // targetOptions her render'da yeniden hesaplanır; yalnızca açılışta sıfırlanır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !form.fromWarehouseId) return;
    let cancelled = false;
    getTransferRequestOptions(form.fromWarehouseId)
      .then((list) => {
        if (!cancelled) setOptions(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setOptions([]);
          toast.error(err instanceof Error ? err.message : "Ürünler yüklenemedi");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, form.fromWarehouseId]);

  const lots = approveTarget
    ? stock.filter(
        (i) =>
          i.warehouseId === approveTarget.fromWarehouseId &&
          i.sku === approveTarget.sku &&
          i.quantity > 0
      )
    : [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const quantity = Number(form.quantity.replace(",", "."));
    if (!form.toWarehouseId || !form.fromWarehouseId || !form.sku) {
      toast.error("Hedef depo, kaynak depo ve ürün seçin");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Pozitif bir miktar girin");
      return;
    }
    setSaving(true);
    try {
      await createTransferRequest({
        fromWarehouseId: form.fromWarehouseId,
        toWarehouseId: form.toWarehouseId,
        sku: form.sku,
        quantity,
        note: form.note.trim() || undefined,
      });
      toast.success("Transfer talebi gönderildi");
      setOpen(false);
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Talep gönderilemedi");
    } finally {
      setSaving(false);
    }
  }

  async function handleReject(row: StockTransfer) {
    if (!window.confirm(`${row.materialName} talebi reddedilsin mi?`)) return;
    setBusyId(row.id);
    try {
      await respondTransferRequest(row.id, { action: "reject" });
      toast.success("Talep reddedildi");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Talep yanıtlanamadı");
    } finally {
      setBusyId(null);
    }
  }

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    if (!approveTarget) return;
    if (!lotId) {
      toast.error("Gönderilecek lotu seçin");
      return;
    }
    setBusyId(approveTarget.id);
    try {
      await respondTransferRequest(approveTarget.id, { action: "approve", sourceItemId: lotId });
      toast.success(
        approveTarget.toWarehouseId === "wh-mamul-istanbul"
          ? "Talep onaylandı, stok İstanbul sevkiyatı için ayrıldı"
          : "Talep onaylandı, stok aktarıldı"
      );
      setApproveTarget(null);
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Talep onaylanamadı");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="glass-card border-none">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="h-5 w-5 text-indigo-600" />
          Transfer talepleri
        </CardTitle>
        {canRequest ? (
          <Button size="sm" className="rounded-xl" onClick={() => setOpen(true)}>
            <Send className="mr-1.5 h-4 w-4" />
            Transfer Talebi
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ürün</TableHead>
              <TableHead>Kaynak → Hedef</TableHead>
              <TableHead>Miktar</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Tarih</TableHead>
              <TableHead className="text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  Bekleyen transfer talebi yok. Onaylanan talepler aktarım ve sevkiyat listelerinde görünür.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const canRespond =
                  row.status === "requested" &&
                  Boolean(user && canRespondTransferRequest(user, row));
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-medium">{row.materialName}</p>
                      {row.note ? (
                        <p className="text-xs text-muted-foreground line-clamp-2">{row.note}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {getWarehouseName(row.fromWarehouseId)}
                      <ArrowRightLeft className="mx-1 inline h-3 w-3 text-muted-foreground" />
                      {getWarehouseName(row.toWarehouseId)}
                    </TableCell>
                    <TableCell>
                      {row.quantity} {row.unit}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status)}>
                        {transferStatusLabel(row.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {canRespond ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            className="rounded-xl"
                            disabled={busyId === row.id}
                            onClick={() => {
                              setApproveTarget(row);
                              setLotId("");
                            }}
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Onayla
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            disabled={busyId === row.id}
                            onClick={() => void handleReject(row)}
                          >
                            <X className="mr-1 h-4 w-4" />
                            Reddet
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {row.status === "requested" ? "Gönderen depo onaylayacak" : "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        icon={Send}
        title="Transfer talebi"
        description="Başka bir mamul deposundan kendi deponuza ürün isteyin. Gönderen depo onaylayınca stok aktarılır; İstanbul'a gelen ürün sevkiyat adımlarıyla ulaşır."
      >
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => void handleCreate(e)}>
          <FormSheetBody className="space-y-5">
            <FormSection title="Depolar">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Hedef depo (sizin)" required>
                  <Select
                    value={form.toWarehouseId || undefined}
                    onValueChange={(toWarehouseId) =>
                      setForm((f) => ({
                        ...f,
                        toWarehouseId,
                        fromWarehouseId: f.fromWarehouseId === toWarehouseId ? "" : f.fromWarehouseId,
                        sku: f.fromWarehouseId === toWarehouseId ? "" : f.sku,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Hedef depo" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetOptions.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Kaynak depo" required>
                  <Select
                    value={form.fromWarehouseId || undefined}
                    onValueChange={(fromWarehouseId) =>
                      setForm((f) => ({ ...f, fromWarehouseId, sku: "" }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Kaynak depo" />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceOptions.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </FormSection>
            <FormSection title="Ürün ve miktar">
              <FormField
                label="Ürün"
                required
                hint={
                  form.fromWarehouseId && options.length === 0
                    ? "Kaynak depoda stoklu mamul yok."
                    : undefined
                }
              >
                <Select
                  value={form.sku || undefined}
                  onValueChange={(sku) => setForm((f) => ({ ...f, sku }))}
                  disabled={!form.fromWarehouseId || options.length === 0}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Önce kaynak depoyu seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.sku} value={o.sku}>
                        {o.name} · {o.sku}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label="Miktar"
                required
                hint={selectedOption ? `Birim: ${selectedOption.unit}` : undefined}
              >
                <Input
                  type="number"
                  min={0}
                  step="any"
                  required
                  className="bg-white"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </FormField>
              <FormField label="Not" optional>
                <Textarea
                  className="bg-white"
                  rows={2}
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                />
              </FormField>
            </FormSection>
          </FormSheetBody>
          <FormSheetFooter>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" className="rounded-xl" disabled={saving}>
              {saving ? "Gönderiliyor…" : "Talep gönder"}
            </Button>
          </FormSheetFooter>
        </form>
      </FormDialog>

      <FormDialog
        open={Boolean(approveTarget)}
        onOpenChange={(next) => {
          if (!next) setApproveTarget(null);
        }}
        icon={Check}
        title="Talebi onayla"
        description={
          approveTarget
            ? `${approveTarget.quantity} ${approveTarget.unit} ${approveTarget.materialName} → ${getWarehouseName(approveTarget.toWarehouseId)}. Gönderilecek lotu seçin.`
            : undefined
        }
      >
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => void handleApprove(e)}>
          <FormSheetBody>
            <FormField
              label="Lot"
              required
              hint={lots.length === 0 ? "Bu ürün deponuzda stokta yok." : undefined}
            >
              <Select value={lotId || undefined} onValueChange={setLotId} disabled={lots.length === 0}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Lot seçin" />
                </SelectTrigger>
                <SelectContent>
                  {lots.map((lot) => (
                    <SelectItem
                      key={lot.id}
                      value={lot.id}
                      disabled={approveTarget ? lot.quantity < approveTarget.quantity : false}
                    >
                      {lot.lotNo || "Lotsuz"} · {lot.quantity} {lot.unit}
                      {lot.expiryDate ? ` · SKT ${formatDate(lot.expiryDate)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </FormSheetBody>
          <FormSheetFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setApproveTarget(null)}
            >
              Vazgeç
            </Button>
            <Button
              type="submit"
              className="rounded-xl"
              disabled={!lotId || busyId === approveTarget?.id}
            >
              Onayla ve gönder
            </Button>
          </FormSheetFooter>
        </form>
      </FormDialog>
    </Card>
  );
}
