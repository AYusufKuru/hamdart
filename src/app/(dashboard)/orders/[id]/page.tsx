"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { orders } from "@/data/mock";
import type { Recipe } from "@/data/recipes";
import {
  createEmptyRecipe,
  getRecipeByOrderId,
} from "@/lib/recipe-store";
import { formatDate, formatNumber } from "@/lib/utils";
import { ArrowLeft, ClipboardList } from "lucide-react";

const statusMap = {
  pending: { label: "Bekliyor", variant: "warning" as const },
  confirmed: { label: "Onaylandı", variant: "info" as const },
  picking: { label: "Toplanıyor", variant: "info" as const },
  shipped: { label: "Sevk Edildi", variant: "success" as const },
  delivered: { label: "Teslim Edildi", variant: "success" as const },
  cancelled: { label: "İptal", variant: "danger" as const },
};

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const order = orders.find((o) => o.id === id);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!order) return;
    const existing = getRecipeByOrderId(order.id);
    setRecipe(
      existing ?? createEmptyRecipe(order.id, order.product, "Üretim Ekibi")
    );
    setReady(true);
  }, [order]);

  if (!order) notFound();

  const status = statusMap[order.status];
  const unitPrice = order.quantity > 0 ? order.value / order.quantity : 0;

  if (!ready || !recipe) {
    return (
      <div className="p-10 text-muted-foreground">Yükleniyor...</div>
    );
  }

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="rounded-xl" asChild>
          <Link href="/orders">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Siparişler
          </Link>
        </Button>
      </div>

      <PageHeader
        badge="Sipariş & Reçete"
        badgeClassName="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
        title={order.orderNo}
        description={`${order.customer} — ${order.product}. Siparişe özel reçete oluşturun; maliyet hammadde tablosundan, gelir fatura tutarından hesaplanır.`}
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

      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-indigo-600" />
        <h2 className="text-xl font-black">Üretim Reçetesi</h2>
      </div>

      <RecipeEditor
        order={order}
        initialRecipe={recipe}
        onSaved={setRecipe}
      />
    </div>
  );
}
