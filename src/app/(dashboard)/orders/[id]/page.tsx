"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Order } from "@/data/mock";
import type { Warehouse } from "@/data/warehouses";
import { getOrder, updateOrderShipment } from "@/lib/order-store";
import { getWarehouses } from "@/lib/warehouse-store";
import type { Recipe } from "@/data/recipes";
import { getRecipeForOrder } from "@/lib/recipe-store";
import { formatDate, formatNumber } from "@/lib/utils";
import { ifAllowed } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import {
  SHIPMENT_STATUSES,
  canSetOrderStatus,
  isStockRole,
  nextShipmentStatus,
} from "@/lib/auth/permissions";
import { ArrowLeft, ClipboardList, Truck } from "lucide-react";

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
  shipped: "Sevkiyatı tamamla",
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
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseName, setWarehouseName] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const showRecipe = canRead("recipes");
  const canShip = Boolean(user && canWrite("orders"));
  const stockOnly = Boolean(user && isStockRole(user.role));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [found, wh] = await Promise.all([
        getOrder(id),
        ifAllowed(canRead("warehouses"), () => getWarehouses(), [] as Warehouse[]),
      ]);
      if (cancelled) return;
      setOrder(found);
      setWarehouses(wh);
      if (!found) {
        setReady(true);
        return;
      }
      setWarehouseName(found.warehouse);
      if (showRecipe) {
        const existing = await getRecipeForOrder(found);
        if (!cancelled) setRecipe(existing ?? null);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, showRecipe, canRead]);

  const warehouseOptions = useMemo(() => {
    const names = warehouses.map((w) => w.name).filter(Boolean);
    if (warehouseName && !names.includes(warehouseName)) {
      return [warehouseName, ...names];
    }
    return names;
  }, [warehouses, warehouseName]);

  if (ready && !order) notFound();

  if (!ready || !order) {
    return <div className="p-10 text-muted-foreground">Yükleniyor...</div>;
  }

  const status = statusMap[order.status] ?? statusMap.pending;
  const unitPrice = order.quantity > 0 ? order.value / order.quantity : 0;
  const shipmentActions = stockOnly
    ? [nextShipmentStatus(order.status)].filter(
        (next): next is (typeof SHIPMENT_STATUSES)[number] => Boolean(next)
      )
    : [...SHIPMENT_STATUSES];

  async function handleShipment(next: (typeof SHIPMENT_STATUSES)[number]) {
    if (!order || !user || !canSetOrderStatus(user.role, next)) return;
    setSaving(true);
    try {
      const updated = await updateOrderShipment(order.id, {
        status: next,
        warehouse: warehouseName || undefined,
      });
      setOrder(updated);
      setWarehouseName(updated.warehouse);
      toast.success(statusMap[next].label);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sevkiyat güncellenemedi");
    } finally {
      setSaving(false);
    }
  }

  async function handleWarehouseSave() {
    if (!order || !warehouseName.trim()) return;
    setSaving(true);
    try {
      const updated = await updateOrderShipment(order.id, {
        warehouse: warehouseName.trim(),
      });
      setOrder(updated);
      setWarehouseName(updated.warehouse);
      toast.success("Sevkiyat deposu kaydedildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Depo kaydedilemedi");
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
            { label: "Depo", value: order.warehouse },
            { label: "Müşteri", value: order.customer },
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
                  Sevk deposu
                </p>
                <Select
                  value={warehouseName}
                  onValueChange={setWarehouseName}
                  disabled={saving}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Depo seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={saving || warehouseName === order.warehouse}
                onClick={() => void handleWarehouseSave()}
              >
                Depoyu kaydet
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
    </div>
  );
}
