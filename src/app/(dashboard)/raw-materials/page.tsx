"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rawMaterials as seedMaterials, type RawMaterial } from "@/data/raw-materials";
import { getAllRawMaterials } from "@/lib/raw-material-store";
import { getAllRawMaterialOrders } from "@/lib/raw-material-order-store";
import { RawMaterialFormSheet } from "@/components/raw-materials/raw-material-form-sheet";
import { formatMoney } from "@/lib/recipe-calculations";
import { Beaker, Plus, Search } from "lucide-react";

const categoryVariant = {
  "Ham Madde": "info" as const,
  Eksipiyan: "secondary" as const,
  Ambalaj: "warning" as const,
  Diğer: "secondary" as const,
};

export default function RawMaterialsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(seedMaterials);
  const [formOpen, setFormOpen] = useState(false);

  const refresh = () => setRawMaterials(getAllRawMaterials());

  useEffect(() => {
    refresh();
  }, []);

  const filtered = rawMaterials.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Maliyet"
        badgeClassName="bg-amber-500/10 text-amber-700 border-amber-500/20"
        title="Hammadde Tablosu"
        description="Reçete maliyet hesapları bu tablodaki birim maliyetlerden çekilir. Tedarik süreci için Hammadde Siparişleri sayfasına gidin."
        actions={
          <>
            <Button className="rounded-2xl" variant="outline" asChild>
              <Link href="/raw-material-orders">Hammadde Siparişleri</Link>
            </Button>
            <Button
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
              onClick={() => setFormOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Hammadde Ekle
            </Button>
          </>
        }
      />

      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <div className="relative max-w-md mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Malzeme veya SKU ara..."
              className="pl-10 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Malzeme</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Birim</TableHead>
                <TableHead className="text-right">Birim Maliyet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow
                  key={m.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => {
                    const rmo = getAllRawMaterialOrders().find(
                      (o) => o.sku.toLowerCase() === m.sku.toLowerCase()
                    );
                    router.push(
                      rmo
                        ? `/raw-material-orders/${rmo.id}`
                        : "/raw-material-orders"
                    );
                  }}
                >
                  <TableCell className="font-mono text-sm">{m.sku}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>
                    <Badge variant={categoryVariant[m.category] ?? "secondary"}>
                      {m.category}
                    </Badge>
                  </TableCell>
                  <TableCell>{m.unit}</TableCell>
                  <TableCell className="text-right font-bold">
                    {formatMoney(m.unitCost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <Beaker className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <p className="font-medium">Malzeme bulunamadı</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="pb-10" />

      <RawMaterialFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={refresh}
      />
    </div>
  );
}
