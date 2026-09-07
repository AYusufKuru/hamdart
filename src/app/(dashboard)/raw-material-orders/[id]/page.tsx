"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { OrderFlowStepper } from "@/components/raw-material-orders/order-flow-stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  rawMaterialOrderStatusConfig,
  rawMaterialOrderSourceLabels,
  type RawMaterialOrder,
} from "@/data/raw-material-orders";
import {
  actionLabels,
  getAvailableActions,
  type RawMaterialOrderAction,
} from "@/lib/raw-material-order-flow";
import {
  applyRawMaterialOrderActionApi,
  getRawMaterialOrder,
  syncReplenishmentOrders,
} from "@/lib/raw-material-order-store";
import { getWarehouseName } from "@/data/warehouses";
import { getWarehouses } from "@/lib/warehouse-store";
import { CanWrite } from "@/components/auth/can-write";
import { formatDate, formatNumber } from "@/lib/utils";
import { ArrowLeft, FileText, FlaskConical, Warehouse } from "lucide-react";
import { toast } from "sonner";

export default function RawMaterialOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<RawMaterialOrder | null | undefined>(
    undefined
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await syncReplenishmentOrders();
      await getWarehouses().catch(() => []);
      const found = await getRawMaterialOrder(id);
      if (!cancelled) setOrder(found ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (order === undefined) {
    return <div className="p-10 text-muted-foreground">Yükleniyor...</div>;
  }

  if (order === null) notFound();

  const status =
    rawMaterialOrderStatusConfig[order.status] ??
    rawMaterialOrderStatusConfig.to_order;
  const actions = getAvailableActions(order.status);

  async function handleAction(action: RawMaterialOrderAction) {
    try {
      const updated = await applyRawMaterialOrderActionApi(order!.id, action);
      setOrder(updated);
      toast.success(
        action === "approve_qc"
          ? "KK onaylandı — lot hedef depoya işlendi"
          : actionLabels[action].label
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem uygulanamadı");
    }
  }

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <Button variant="ghost" size="sm" className="rounded-xl" asChild>
        <Link href="/raw-material-orders">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Hammadde Siparişleri
        </Link>
      </Button>

      <PageHeader
        badge="Hammadde Tedarik"
        badgeClassName="bg-amber-500/10 text-amber-700 border-amber-500/20"
        title={order.materialName}
        description={`${order.orderNo} · ${order.supplier}`}
        actions={<Badge variant={status.variant}>{status.label}</Badge>}
      />

      <Card className="glass-card border-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Süreç Durumu</CardTitle>
          <p className="text-sm text-muted-foreground">{status.description}</p>
        </CardHeader>
        <CardContent>
          <OrderFlowStepper order={order} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card border-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Sipariş Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            {[
              {
                label: "Kaynak",
                value: rawMaterialOrderSourceLabels[order.source] ?? "—",
              },
              { label: "Sipariş No", value: order.orderNo },
              { label: "SKU", value: order.sku },
              {
                label: "Miktar",
                value: `${formatNumber(order.quantity)} ${order.unit}`,
              },
              {
                label: "Birim Fiyat",
                value: `₺${formatNumber(order.unitPrice)}`,
              },
              {
                label: "Toplam",
                value: `₺${formatNumber(order.totalPrice)}`,
              },
              { label: "Sipariş Tarihi", value: formatDate(order.orderDate) },
              {
                label: "Beklenen Teslimat",
                value: order.expectedDelivery
                  ? formatDate(order.expectedDelivery)
                  : "—",
              },
              { label: "Fatura No", value: order.invoiceNo ?? "—" },
              { label: "Lot No", value: order.lotNo ?? "—" },
            ].map((row) => (
              <div key={row.label}>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {row.label}
                </p>
                <p className="font-bold mt-1">{row.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-card border-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="w-4 h-4" />
              Kalite & Depo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30">
              <Warehouse className="w-4 h-4 text-violet-600" />
              <span>
                Hedef:{" "}
                <strong>{getWarehouseName(order.targetWarehouseId)}</strong>
              </span>
            </div>
            {[
              { label: "Teslim Alma", value: order.receivedDate, date: true },
              { label: "KK Başlangıç", value: order.qcStartedAt, date: true },
              { label: "KK Bitiş", value: order.qcCompletedAt, date: true },
              { label: "Depo Girişi", value: order.warehousedAt, date: true },
              { label: "İade Tarihi", value: order.returnedAt, date: true },
              { label: "Analist", value: order.qcAnalyst, date: false },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium text-right">
                  {row.date
                    ? row.value
                      ? formatDate(row.value)
                      : "—"
                    : row.value || "—"}
                </span>
              </div>
            ))}
            {order.sourceNote && (
              <div className="rounded-xl border p-3 bg-indigo-500/5">
                <p className="text-[10px] font-black uppercase text-indigo-800">
                  Talep notu
                </p>
                <p className="text-sm mt-1">{order.sourceNote}</p>
              </div>
            )}
            {order.qcNotes && (
              <div className="rounded-xl border p-3 bg-amber-500/5 border-amber-500/20">
                <p className="text-[10px] font-black uppercase text-amber-800">
                  KK Notu
                </p>
                <p className="text-sm mt-1">{order.qcNotes}</p>
              </div>
            )}
            {order.status === "returned" && (
              <div className="rounded-xl border p-3 bg-rose-500/5 border-rose-500/20 text-sm">
                <p className="font-bold text-rose-800">İade tamamlandı</p>
                <p className="text-rose-700/90 mt-1">
                  Geri fatura kesildi ({order.invoiceNo}), ürün tedarikçiye iade
                  edildi.
                </p>
              </div>
            )}
            {order.status === "warehoused" && (
              <div className="rounded-xl border p-3 bg-emerald-500/5 border-emerald-500/20 text-sm space-y-3">
                <div>
                  <p className="font-bold text-emerald-800">Depo kaydı tamam</p>
                  <p className="text-emerald-700/90 mt-1">
                    Lot {order.lotNo} — {getWarehouseName(order.targetWarehouseId)}{" "}
                    envanterine işlendi.
                  </p>
                </div>
                <Button variant="outline" className="rounded-xl" asChild>
                  <Link href={`/warehouses/${order.targetWarehouseId}`}>
                    <Warehouse className="w-4 h-4 mr-2" />
                    Depo envanterini aç
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {actions.length > 0 && (
        <CanWrite resource="raw_material_orders">
          <Card className="glass-card border-none">
            <CardHeader>
              <CardTitle className="text-base">Sonraki Adım</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {actions.map((action) => {
                const meta = actionLabels[action];
                return (
                  <Button
                    key={action}
                    variant={
                      meta.variant === "destructive" ? "destructive" : "default"
                    }
                    className="rounded-xl"
                    onClick={() => void handleAction(action)}
                  >
                    {meta.label}
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        </CanWrite>
      )}

      <div className="pb-10" />
    </div>
  );
}
