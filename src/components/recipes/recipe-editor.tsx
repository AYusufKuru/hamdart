"use client";

import { useEffect, useMemo, useState } from "react";
import type { Order } from "@/data/mock";
import { orders as seedOrders } from "@/data/mock";
import { getAllOrders } from "@/lib/order-store";
import type { Recipe, RecipeExtra, RecipeLine } from "@/data/recipes";
import { rawMaterials as seedMaterials, type RawMaterial } from "@/data/raw-materials";
import { getAllRawMaterials } from "@/lib/raw-material-store";
import {
  calculateRecipeTotals,
  formatMoney,
  getLastOrderUnitPrice,
} from "@/lib/recipe-calculations";
import { saveRecipe } from "@/lib/recipe-store";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Save, Trash2, FileText, ClipboardList } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface RecipeEditorProps {
  order: Order;
  initialRecipe: Recipe;
  onSaved: (recipe: Recipe) => void;
}

export function RecipeEditor({
  order,
  initialRecipe,
  onSaved,
}: RecipeEditorProps) {
  const [recipe, setRecipe] = useState<Recipe>(initialRecipe);
  const [allOrders, setAllOrders] = useState(seedOrders);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(seedMaterials);

  useEffect(() => {
    setAllOrders(getAllOrders());
    setRawMaterials(getAllRawMaterials());
  }, []);

  const totals = useMemo(
    () =>
      calculateRecipeTotals(
        recipe,
        order.quantity,
        order,
        allOrders,
        rawMaterials
      ),
    [recipe, order, allOrders, rawMaterials]
  );

  const lastUnitPrice = getLastOrderUnitPrice(
    order.product,
    allOrders,
    order.id
  );

  function updateLine(index: number, patch: Partial<RecipeLine>) {
    setRecipe((r) => ({
      ...r,
      lines: r.lines.map((line, i) =>
        i === index ? { ...line, ...patch } : line
      ),
    }));
  }

  function addLine() {
    const materialId = rawMaterials[0]?.id;
    if (!materialId) {
      toast.error("Önce hammadde tablosuna malzeme ekleyin");
      return;
    }
    setRecipe((r) => ({
      ...r,
      lines: [...r.lines, { materialId, quantityPerUnit: 0 }],
    }));
  }

  function removeLine(index: number) {
    setRecipe((r) => ({
      ...r,
      lines: r.lines.filter((_, i) => i !== index),
    }));
  }

  function updateExtra(index: number, patch: Partial<RecipeExtra>) {
    setRecipe((r) => ({
      ...r,
      extras: r.extras.map((ex, i) =>
        i === index ? { ...ex, ...patch } : ex
      ),
    }));
  }

  function addExtra() {
    const materialId = rawMaterials[0]?.id;
    if (!materialId) {
      toast.error("Önce hammadde tablosuna malzeme ekleyin");
      return;
    }
    setRecipe((r) => ({
      ...r,
      extras: [
        ...r.extras,
        {
          id: `ext-${Date.now()}`,
          materialId,
          quantity: 1,
          reason: "",
        },
      ],
    }));
  }

  function removeExtra(index: number) {
    setRecipe((r) => ({
      ...r,
      extras: r.extras.filter((_, i) => i !== index),
    }));
  }

  function handleSave() {
    if (
      recipe.lines.length === 0 ||
      recipe.lines.every((l) => !l.quantityPerUnit)
    ) {
      toast.error("En az bir malzeme satırına miktar girin");
      return;
    }
    try {
      const saved: Recipe = { ...recipe, status: "saved" };
      saveRecipe(saved);
      setRecipe(saved);
      onSaved(saved);
      toast.success("Reçete kaydedildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reçete kaydedilemedi");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card border-none">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-lg font-black">Reçete Satırları</CardTitle>
            <Badge variant={recipe.status === "saved" ? "success" : "warning"}>
              {recipe.status === "saved" ? "Kayıtlı" : "Taslak"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Her satır 1 {order.unit} çıktı için gereken malzeme miktarını gösterir.
            Sipariş miktarı ({formatNumber(order.quantity)} {order.unit}) ile çarpılır.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Malzeme</TableHead>
                <TableHead>Birim / Miktar (1 çıktı)</TableHead>
                <TableHead>Toplam İhtiyaç</TableHead>
                <TableHead className="text-right">Birim Maliyet</TableHead>
                <TableHead className="text-right">Satır Maliyeti</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {totals.lines.map((line, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <select
                      className="w-full min-w-[160px] rounded-lg border bg-background px-2 py-1.5 text-sm"
                      value={recipe.lines[index]?.materialId ?? ""}
                      onChange={(e) =>
                        updateLine(index, { materialId: e.target.value })
                      }
                    >
                      {recipe.lines[index]?.materialId &&
                      !rawMaterials.some(
                        (m) => m.id === recipe.lines[index].materialId
                      ) ? (
                        <option value={recipe.lines[index].materialId}>
                          Bilinmeyen malzeme
                        </option>
                      ) : null}
                      {rawMaterials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        className="w-28 rounded-lg"
                        value={recipe.lines[index].quantityPerUnit}
                        onChange={(e) =>
                          updateLine(index, {
                            quantityPerUnit: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        {line.unit}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {line.totalQuantity.toLocaleString("tr-TR", {
                      maximumFractionDigits: 6,
                    })}{" "}
                    {line.unit}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatMoney(line.unitCost)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatMoney(line.lineCost)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeLine(index)}
                      disabled={recipe.lines.length <= 1}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button variant="outline" className="rounded-xl" onClick={addLine}>
            <Plus className="w-4 h-4 mr-2" />
            Malzeme Ekle
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card border-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-black flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            Ek Ürünler & Notlar
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Reçeteye sonradan eklenen malzemeler — miktar ve ekleme gerekçesi ile
            birlikte maliyete dahil edilir.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {recipe.extras.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Henüz ek ürün notu yok.
            </p>
          ) : (
            <div className="space-y-4">
              {recipe.extras.map((extra, index) => (
                <div
                  key={extra.id}
                  className="rounded-xl border bg-muted/30 p-4 space-y-3"
                >
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[180px]">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Ürün / Malzeme
                      </label>
                      <select
                        className="w-full mt-1 rounded-lg border bg-background px-2 py-1.5 text-sm"
                        value={extra.materialId}
                        onChange={(e) =>
                          updateExtra(index, { materialId: e.target.value })
                        }
                      >
                        {!rawMaterials.some((m) => m.id === extra.materialId) ? (
                          <option value={extra.materialId}>Bilinmeyen malzeme</option>
                        ) : null}
                        {rawMaterials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-28">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Miktar
                      </label>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        className="mt-1 rounded-lg"
                        value={extra.quantity}
                        onChange={(e) =>
                          updateExtra(index, {
                            quantity: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="text-sm font-bold pb-2">
                      Maliyet:{" "}
                      {formatMoney(totals.extras[index]?.lineCost ?? 0)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 ml-auto"
                      onClick={() => removeExtra(index)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Açıklama — neden eklendi?
                    </label>
                    <textarea
                      className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm min-h-[72px] resize-y"
                      placeholder="Örn: Tablet kaynaklanması için ek stearik asit eklendi"
                      value={extra.reason}
                      onChange={(e) =>
                        updateExtra(index, { reason: e.target.value })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" className="rounded-xl" onClick={addExtra}>
            <Plus className="w-4 h-4 mr-2" />
            Ek Ürün Notu Ekle
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Toplam Maliyet", value: formatMoney(totals.totalCost) },
          {
            label: "Toplam Gelir (Fatura)",
            value: formatMoney(totals.totalRevenue),
            hint: "Siparişte girilen fatura tutarı",
          },
          { label: "Kar / Zarar", value: formatMoney(totals.profit) },
          {
            label: "Marj",
            value:
              totals.marginPercent !== null
                ? `%${totals.marginPercent.toFixed(1)}`
                : "—",
          },
        ].map((stat) => (
          <Card key={stat.label} className="glass-card border-none">
            <CardContent className="p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </p>
              <p className="text-2xl font-black mt-1">{stat.value}</p>
              {"hint" in stat && stat.hint && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {stat.hint}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {lastUnitPrice !== null && (
        <p className="text-xs text-muted-foreground">
          Bu ürün için önceki sipariş birim fiyatı (referans):{" "}
          <span className="font-bold">
            {formatMoney(lastUnitPrice)} / {order.unit}
          </span>
        </p>
      )}

      <div className="flex justify-end gap-3 pb-6 flex-wrap">
        {recipe.status === "saved" && (
          <Button variant="outline" className="rounded-2xl" asChild>
            <Link href="/recipes">
              <ClipboardList className="w-4 h-4 mr-2" />
              Reçete listesinde gör
            </Link>
          </Button>
        )}
        <Button
          className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
          onClick={handleSave}
        >
          <Save className="w-4 h-4 mr-2" />
          Reçeteyi Kaydet
        </Button>
      </div>
    </div>
  );
}
