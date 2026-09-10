"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RawMaterial } from "@/data/raw-materials";
import { getAllRawMaterials } from "@/lib/raw-material-store";
import { getAllRawMaterialOrders } from "@/lib/raw-material-order-store";
import { RawMaterialFormSheet } from "@/components/raw-materials/raw-material-form-sheet";
import { SearchTable, type Column } from "@/components/shared/search-table";
import { CanWrite } from "@/components/auth/can-write";
import { Plus } from "lucide-react";

const columns: Column<RawMaterial>[] = [
  {
    key: "sku",
    header: "SKU",
    className: "font-mono text-sm",
    render: (m) => m.sku,
  },
  { key: "name", header: "Malzeme Adı", render: (m) => m.name },
  {
    key: "category",
    header: "Kategori",
    render: (m) => <Badge variant="secondary">{m.category}</Badge>,
  },
  { key: "unit", header: "Birim", render: (m) => m.unit },
];

export default function RawMaterialsPage() {
  const router = useRouter();
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [rawMaterialOrders, setRawMaterialOrders] = useState<
    Awaited<ReturnType<typeof getAllRawMaterialOrders>>
  >([]);
  const [formOpen, setFormOpen] = useState(false);

  const refresh = async () => {
    const [materials, orders] = await Promise.all([
      getAllRawMaterials(),
      getAllRawMaterialOrders(),
    ]);
    setRawMaterials(materials);
    setRawMaterialOrders(orders);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Maliyet"
        badgeClassName="bg-amber-500/10 text-amber-700 border-amber-500/20"
        title="Hammadde"
        description="Excel hammadde kataloğu (SKU, malzeme adı, kategori, birim)."
        actions={
          <>
            <CanWrite resource="raw_materials">
              <Button
                className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
                onClick={() => setFormOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Hammadde Ekle
              </Button>
            </CanWrite>
          </>
        }
      />

      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <SearchTable
            rows={rawMaterials}
            columns={columns}
            searchText={(m) => `${m.sku} ${m.name} ${m.category}`}
            pageSize={25}
            onRowClick={(m) => {
              const rmo = rawMaterialOrders.find(
                (o) => o.sku.toLowerCase() === m.sku.toLowerCase()
              );
              router.push(
                rmo ? `/raw-material-orders/${rmo.id}` : "/raw-material-orders"
              );
            }}
          />
        </CardContent>
      </Card>

      <RawMaterialFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={refresh}
      />
    </div>
  );
}
