"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Order } from "@/data/mock";
import { getOrder, updateOrderShipment } from "@/lib/order-store";
import type { Recipe } from "@/data/recipes";
import { getRecipeForOrder } from "@/lib/recipe-store";
import { formatDate, formatNumber } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import {
  SHIPMENT_STATUSES,
  canSetOrderStatus,
  isStockRole,
  nextShipmentStatus,
} from "@/lib/auth/permissions";
import { ArrowLeft, ClipboardList, Truck } from "lucide-react";
import { ShipOutDialog } from "@/components/orders/ship-out-dialog";

const statusMap = {
  pending: { label: "Bekliyor", variant: "warning" as const },
  confirmed: { label: "Onaylandı", variant: "info" as const },
  picking: { label: "Toplanıyor", variant: "info" as const },
  shipped: { label: "Sevk Edildi", variant: "success" as const },
  delivered: { label: "Teslim Edildi", variant: "success" as const },
  cancelled: { label: "İptal", variant: "danger" as const },
};

const shipmentLabels: Record<(typeof SHIPMENT_STATUSES)[number], string> = {
  picking: "Toplamayı başlat",
  shipped: "Sevke çıkar",
  delivered: "Teslim edildi işaretle",
};

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, canRead, canWrite } = useAuth();
  const [order, setOrder] = useState<Order | undefined>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [shipmentNote, setShipmentNote] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const showRecipe = canRead("recipes");
  const canShip = Boolean(user && canWrite("orders"));
  const stockOnly = Boolean(user && isStockRole(user.role));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const found = await getOrder(id);
      if (cancelled) return;
      setOrder(found);
      if (!found) {
        setReady(true);
        return;
      }
      setShipmentNote(found.shipmentNote ?? "");
      if (showRecipe) {
        const existing = await getRecipeForOrder(found);
        if (!cancelled) setRecipe(existing ?? null);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, showRecipe]);

  if (ready && !order) notFound();

  if (!ready || !order) {
    return <div className="p-10 text-muted-foreground">Yükleniyor...</div>;
  }

  const status = statusMap[order.status] ?? statusMap.pending;
  const unitPrice = order.quantity > 0 ? order.value / order.quantity : 0;
  const readyToShip =
    order.status === "pending" ||
    order.status === "confirmed" ||
    order.status === "picking";
  const shipmentActions = stockOnly
    ? order.batchNo && readyToShip
      ? (["shipped"] as const)
      : ([nextShipmentStatus(order.status)].filter(
          (next): next is (typeof SHIPMENT_STATUSES)[number] => Boolean(next)
        ) as (typeof SHIPMENT_STATUSES)[number][])
    : [...SHIPMENT_STATUSES];

  async function handleShipment(next: (typeof SHIPMENT_STATUSES)[number]) {
    if (!order || !user || !canSetOrderStatus(user.role, next)) return;
    if (next === "shipped") {
      setShipOpen(true);
      return;
    }
    setSaving(true);
    try {
      const updated = await updateOrderShipment(order.id, {
        status: next,
        shipmentNote: shipmentNote.trim(),
      });
      setOrder(updated);
      setShipmentNote(updated.shipmentNote ?? "");
      toast.success(statusMap[next].label);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sevkiyat güncellenemedi");
    } finally {
      setSaving(false);
    }
  }

  async function handleNoteSave() {
    if (!order) return;
    setSaving(true);
    try {
      const updated = await updateOrderShipment(order.id, {
        shipmentNote: shipmentNote.trim(),
      });
      setOrder(updated);
      setShipmentNote(updated.shipmentNote ?? "");
      toast.success("Sevkiyat notu kaydedildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Not kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="rounded-xl" asChild>
          <Link href="/orders">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Sevkiyat
          </Link>
        </Button>
      </div>

      <PageHeader
        badge="Sevkiyat"
        badgeClassName="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
        title={order.orderNo}
        description={`${order.customer} — ${order.product}`}
        actions={
          <Badge variant={status.variant} className="text-sm px-3 py-1">
            {status.label}
          </Badge>
        }
      />

      <Card className="glass-card border-none">
        <CardContent className="p-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Ürün", value: order.product },
            {
              label: "İstenen Miktar",
              value: `${formatNumber(order.quantity)} ${order.unit}`,
            },
            {
              label: "Fatura Tutarı (Gelir)",
              value: `₺${formatNumber(order.value)}`,
            },
            {
              label: "Birim Fiyat",
              value: `₺${unitPrice.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} / ${order.unit}`,
            },
            { label: "Sipariş Tarihi", value: formatDate(order.orderDate) },
            { label: "Teslimat", value: formatDate(order.deliveryDate) },
            { label: "Müşteri", value: order.customer },
            { label: "Parti", value: order.batchNo ?? "—" },
            { label: "Teslimat yeri", value: order.destination ?? "—" },
            { label: "Sevkiyat notu", value: order.shipmentNote ?? "—" },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {item.label}
              </p>
              <p className="font-bold mt-1">{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {canShip && (
        <Card className="glass-card border-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Sevkiyat bilgisi ve tamamlama
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Sevkiyat notu
                </p>
                <Textarea
                  value={shipmentNote}
                  disabled={saving}
                  placeholder="Müşteri, irsaliye, plaka veya teslim notu"
                  onChange={(e) => setShipmentNote(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={
                  saving ||
                  shipmentNote.trim() === (order.shipmentNote ?? "").trim()
                }
                onClick={() => void handleNoteSave()}
              >
                Notu kaydet
              </Button>
            </div>
            {shipmentActions.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {shipmentActions.map((next) => (
                  <Button
                    key={next}
                    className="rounded-xl"
                    variant={order.status === next ? "default" : "outline"}
                    disabled={saving || order.status === next}
                    onClick={() => void handleShipment(next)}
                  >
                    {shipmentLabels[next]}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Bu siparişte yapılacak sevkiyat adımı kalmadı.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {showRecipe && recipe && (
        <>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-black">Üretim Reçetesi</h2>
          </div>
          <RecipeEditor
            order={order}
            initialRecipe={recipe}
            onSaved={setRecipe}
          />
        </>
      )}
      <ShipOutDialog
        open={shipOpen}
        order={order}
        onOpenChange={setShipOpen}
        onShipped={(updated) => {
          setOrder(updated);
          setShipmentNote(updated.shipmentNote ?? "");
          setShipOpen(false);
        }}
      />
    </div>
  );
}
