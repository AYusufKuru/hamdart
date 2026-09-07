"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { RecipeDetailPanel } from "@/components/recipes/recipe-detail-panel";
import { RecipeFormSheet } from "@/components/recipes/recipe-form-sheet";
import { Button } from "@/components/ui/button";
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
import { type Order } from "@/data/mock";
import { getAllOrders } from "@/lib/order-store";
import { type RawMaterial } from "@/data/raw-materials";
import { type Recipe } from "@/data/recipes";
import { getAllRawMaterials } from "@/lib/raw-material-store";
import { getAllRecipes } from "@/lib/recipe-store";
import { CanWrite } from "@/components/auth/can-write";
import { cn } from "@/lib/utils";
import { ClipboardList, Plus } from "lucide-react";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const refresh = useCallback(async () => {
    const [recipeList, orderList, materialList] = await Promise.all([
      getAllRecipes(),
      getAllOrders(),
      getAllRawMaterials(),
    ]);
    setRecipes(recipeList);
    setOrders(orderList);
    setMaterials(materialList);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
        actions={
          <CanWrite resource="recipes">
            <Button
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
              onClick={() => setFormOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Reçete Ekle
            </Button>
          </CanWrite>
        }
      />

      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reçete Kodu</TableHead>
                <TableHead>Ürün Kodu</TableHead>
                <TableHead>Ürün adı</TableHead>
                <TableHead>Satır</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipes.map((recipe) => {
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
                    <TableCell className="font-mono text-sm">
                      {recipe.code || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {recipe.productCode || "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {recipe.productName}
                    </TableCell>
                    <TableCell>{recipe.lines.length}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          recipe.status === "saved" ? "success" : "warning"
                        }
                      >
                        {recipe.status === "saved" ? "Kayıtlı" : "Taslak"}
                      </Badge>
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
                Reçete Ekle ile yeni reçete oluşturun.
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
              materials={materials}
              index={selectedIndex}
              total={recipes.length}
              onPrevious={() => goToIndex(selectedIndex - 1)}
              onNext={() => goToIndex(selectedIndex + 1)}
            />
          )}
        </SheetContent>
      </Sheet>

      <RecipeFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={refresh}
      />
    </div>
  );
}
