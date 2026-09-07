"use client";

import Link from "next/link";
import type { Order } from "@/data/mock";
import type { RawMaterial } from "@/data/raw-materials";
import type { Recipe } from "@/data/recipes";
import {
  calculateRecipeTotals,
  formatMoney,
} from "@/lib/recipe-calculations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatNumber } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

interface RecipeDetailPanelProps {
  recipe: Recipe;
  order: Order | undefined;
  allOrders: Order[];
  materials?: RawMaterial[];
  index: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}

export function RecipeDetailPanel({
  recipe,
  order,
  allOrders,
  materials,
  index,
  total,
  onPrevious,
  onNext,
}: RecipeDetailPanelProps) {
  const totals = order
    ? calculateRecipeTotals(
        recipe,
        order.quantity,
        order,
        allOrders,
        materials
      )
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-6 py-3 border-b bg-muted/30">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={onPrevious}
          disabled={index <= 0}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs font-bold text-muted-foreground tabular-nums">
          {index + 1} / {total}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={onNext}
          disabled={index >= total - 1}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-black">{recipe.productName}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {recipe.code || "Reçete kodu yok"}
              {recipe.productCode ? ` · ${recipe.productCode}` : ""}
              {order ? ` · ${order.orderNo}` : ""}
            </p>
          </div>
          <Badge variant={recipe.status === "saved" ? "success" : "warning"}>
            {recipe.status === "saved" ? "Kayıtlı" : "Taslak"}
          </Badge>
        </div>

        {order && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Sipariş Miktarı
              </p>
              <p className="font-bold mt-1">
                {formatNumber(order.quantity)} {order.unit}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Müşteri
              </p>
              <p className="font-bold mt-1 truncate">{order.customer}</p>
            </div>
          </div>
        )}

        {totals && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Toplam Maliyet", value: formatMoney(totals.totalCost) },
              { label: "Gelir (Fatura)", value: formatMoney(totals.totalRevenue) },
              { label: "Kar / Zarar", value: formatMoney(totals.profit) },
              {
                label: "Marj",
                value:
                  totals.marginPercent !== null
                    ? `%${totals.marginPercent.toFixed(1)}`
                    : "—",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border bg-card p-3"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {s.label}
                </p>
                <p className="text-lg font-black mt-1">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        <Separator />

        <section>
          <h4 className="text-sm font-black mb-3">
            Hammadde adı · Birim · Birim Miktar
          </h4>
          {recipe.lines.length > 0 ? (
            <ul className="space-y-2">
              {recipe.lines.map((line, i) => (
                <li
                  key={i}
                  className="rounded-xl border p-3 text-sm flex justify-between gap-3"
                >
                  <p className="font-bold min-w-0 truncate">
                    {line.materialName || "—"}
                  </p>
                  <p className="text-muted-foreground shrink-0">
                    {line.quantityPerUnit} {line.unit || ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Satır yok</p>
          )}
        </section>

        {recipe.extras.length > 0 && (
          <section>
            <h4 className="text-sm font-black mb-3">Ek Ürünler & Notlar</h4>
            <ul className="space-y-3">
              {totals?.extras.map((extra) => (
                <li
                  key={extra.id}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm"
                >
                  <div className="flex justify-between gap-3">
                    <p className="font-bold">{extra.materialName}</p>
                    <p className="font-bold shrink-0">
                      {formatMoney(extra.lineCost)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {extra.quantity} {extra.unit}
                  </p>
                  {extra.reason && (
                    <p className="text-xs mt-2 leading-relaxed border-t border-amber-500/10 pt-2">
                      {extra.reason}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-[10px] text-muted-foreground">
          Oluşturulma: {formatDate(recipe.createdAt)}
        </p>
      </div>

      {order && (
        <div className="px-6 py-4 border-t bg-muted/20">
          <Button variant="outline" className="w-full rounded-xl" asChild>
            <Link href={`/orders/${order.id}`}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Tam Düzenleme (Sipariş)
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
