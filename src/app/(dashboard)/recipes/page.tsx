"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { RecipeDetailPanel } from "@/components/recipes/recipe-detail-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orders } from "@/data/mock";
import type { Recipe } from "@/data/recipes";
import { calculateRecipeTotals, formatMoney } from "@/lib/recipe-calculations";
import { getAllRecipes } from "@/lib/recipe-store";
import { cn, formatDate } from "@/lib/utils";
import { ClipboardList } from "lucide-react";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setRecipes(getAllRecipes());
  }, []);

  const selectedIndex = selectedId
    ? recipes.findIndex((r) => r.id === selectedId)
    : -1;
  const selectedRecipe =
    selectedIndex >= 0 ? recipes[selectedIndex] : undefined;
  const selectedOrder = selectedRecipe
    ? orders.find((o) => o.id === selectedRecipe.orderId)
    : undefined;

  const openRecipe = useCallback((recipeId: string) => {
    setSelectedId(recipeId);
    setDrawerOpen(true);
  }, []);

  const goToIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < recipes.length) {
        setSelectedId(recipes[index].id);
      }
    },
    [recipes]
  );

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goToIndex(selectedIndex - 1);
      if (e.key === "ArrowRight") goToIndex(selectedIndex + 1);
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, selectedIndex, goToIndex]);

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Üretim"
        badgeClassName="bg-violet-500/10 text-violet-600 border-violet-500/20"
        title="Kayıtlı Reçeteler"
        description="Satıra tıklayarak reçeteyi sağ panelde önizleyin. Ok tuşları veya paneldeki geçiş ile reçeteler arasında hızlıca dolaşın."
      />

      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ürün</TableHead>
                <TableHead>Sipariş</TableHead>
                <TableHead>Oluşturan</TableHead>
                <TableHead>Satır</TableHead>
                <TableHead>Ek Not</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Toplam Maliyet</TableHead>
                <TableHead className="text-right">Gelir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipes.map((recipe) => {
                const order = orders.find((o) => o.id === recipe.orderId);
                const totals = order
                  ? calculateRecipeTotals(
                      recipe,
                      order.quantity,
                      order,
                      orders
                    )
                  : null;
                const isSelected = drawerOpen && selectedId === recipe.id;

                return (
                  <TableRow
                    key={recipe.id}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected
                        ? "bg-indigo-500/10 hover:bg-indigo-500/15"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => openRecipe(recipe.id)}
                  >
                    <TableCell className="font-medium">
                      {recipe.productName}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {order?.orderNo ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {recipe.createdBy}
                    </TableCell>
                    <TableCell>{recipe.lines.length}</TableCell>
                    <TableCell>{recipe.extras.length}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          recipe.status === "saved" ? "success" : "warning"
                        }
                      >
                        {recipe.status === "saved" ? "Kayıtlı" : "Taslak"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {totals ? formatMoney(totals.totalCost) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {totals ? formatMoney(totals.totalRevenue) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {recipes.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <p className="font-medium">Henüz kayıtlı reçete yok</p>
              <p className="text-sm mt-2">
                Bir sipariş detayından reçete oluşturup kaydedin.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground pb-10">
        {recipes.length} reçete — satıra tıklayın veya panelde ← → kullanın
      </p>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="p-0 w-[40vw] max-w-[40vw] min-w-[40vw] flex flex-col gap-0 overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Reçete Önizleme</SheetTitle>
            <SheetDescription>
              Seçili reçetenin malzeme, maliyet ve ek not detayları
            </SheetDescription>
          </SheetHeader>

          {selectedRecipe && selectedIndex >= 0 && (
            <RecipeDetailPanel
              recipe={selectedRecipe}
              order={selectedOrder}
              allOrders={orders}
              index={selectedIndex}
              total={recipes.length}
              onPrevious={() => goToIndex(selectedIndex - 1)}
              onNext={() => goToIndex(selectedIndex + 1)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
