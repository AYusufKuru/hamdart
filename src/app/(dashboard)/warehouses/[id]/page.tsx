"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { WarehouseStockTable } from "@/components/warehouses/warehouse-stock-table";
import { warehouseTypeConfig } from "@/components/warehouses/warehouse-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getWarehouse,
  getStockByWarehouse,
  getCategoriesForWarehouse,
  getTransfersForWarehouse,
  getWarehouseName,
  warehouseTypeLabels,
  WAREHOUSE_IDS,
} from "@/data/warehouses";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRightLeft,
  Droplets,
  MapPin,
  Thermometer,
  User,
} from "lucide-react";

const transferReasonLabel = {
  replenishment: "Ana depodan aktarım",
  direct_lab: "Doğrudan lab girişi",
  manual: "Manuel",
};

export default function WarehouseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const warehouse = getWarehouse(id);

  if (!warehouse) notFound();

  const items = getStockByWarehouse(id);
  const categories = getCategoriesForWarehouse(id);
  const transfers = getTransfersForWarehouse(id);
  const config = warehouseTypeConfig[warehouse.type];
  const Icon = config.icon;
  const utilization = Math.round((warehouse.used / warehouse.capacity) * 100);

  const stats = useMemo(() => {
    const alerts = items.filter(
      (i) =>
        i.status === "low" ||
        i.status === "critical" ||
        i.status === "expiring"
    );
    const lowLab = items.filter(
      (i) =>
        i.warehouseId === WAREHOUSE_IDS.laboratory &&
        !i.labDirectEntry &&
        i.labTargetQuantity !== undefined &&
        i.quantity < i.minStock
    );
    return {
      total: items.length,
      alerts: alerts.length,
      categories: categories.length,
      lowLab: lowLab.length,
    };
  }, [items, categories.length]);

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <Button variant="ghost" size="sm" className="rounded-xl -ml-2" asChild>
        <Link href="/warehouses">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Tüm Depolar
        </Link>
      </Button>

      <PageHeader
        badge={warehouseTypeLabels[warehouse.type]}
        badgeClassName={config.badgeClassName}
        title={warehouse.name}
        description={warehouse.description}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Stok Kalemi", value: stats.total },
          { label: "Kategori", value: stats.categories },
          { label: "Uyarılı Ürün", value: stats.alerts },
          { label: "Doluluk", value: `%${utilization}` },
          ...(warehouse.type === "laboratory"
            ? [{ label: "Aktarım Gerekli", value: stats.lowLab }]
            : []),
        ].map((s) => (
          <Card key={s.label} className="glass-card border-none">
            <CardContent className="p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
              <p className="text-2xl font-black mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-3 rounded-xl bg-muted/50">
                <Icon className="w-6 h-6 text-violet-600" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  {warehouse.location}
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4 text-rose-500" />
                    {warehouse.temperature}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Droplets className="w-4 h-4 text-blue-500" />
                    {warehouse.humidity}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    {warehouse.manager}
                  </span>
                </div>
                <div className="max-w-md">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Kapasite</span>
                    <span className="font-bold">
                      {formatNumber(warehouse.used)} /{" "}
                      {formatNumber(warehouse.capacity)} birim
                    </span>
                  </div>
                  <Progress value={utilization} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Son denetim: {formatDate(warehouse.lastAudit)}
                </p>
              </div>
            </div>
            <Badge variant={config.badge} className="w-fit">
              {warehouseTypeLabels[warehouse.type]}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle>Depo Envanteri</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tüm ürünler — arama, kategori ve durum filtresi ile listeleyin.
          </p>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <WarehouseStockTable
            items={items}
            warehouseId={id}
            categories={categories}
          />
        </CardContent>
      </Card>

      {warehouse.type === "laboratory" && transfers.length > 0 && (
        <Card className="glass-card border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-violet-600" />
              Bu Depoya İlişkin Aktarımlar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Malzeme</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Miktar</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((tr) => (
                  <TableRow key={tr.id}>
                    <TableCell className="font-medium">{tr.materialName}</TableCell>
                    <TableCell className="text-sm">
                      {getWarehouseName(tr.fromWarehouseId)}
                    </TableCell>
                    <TableCell>
                      {tr.quantity} {tr.unit}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          tr.reason === "direct_lab" ? "warning" : "secondary"
                        }
                      >
                        {transferReasonLabel[tr.reason]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          tr.status === "completed" ? "success" : "info"
                        }
                      >
                        {tr.status === "completed" ? "Tamamlandı" : "Bekliyor"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {warehouse.type === "production" && transfers.length > 0 && (
        <Card className="glass-card border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="w-5 h-5 text-amber-600" />
              Laboratuvara Gönderilen Aktarımlar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Malzeme</TableHead>
                  <TableHead>Miktar</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Not</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((tr) => (
                  <TableRow key={tr.id}>
                    <TableCell className="font-medium">{tr.materialName}</TableCell>
                    <TableCell>
                      {tr.quantity} {tr.unit}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          tr.status === "completed" ? "success" : "info"
                        }
                      >
                        {tr.status === "completed" ? "Tamamlandı" : "Bekliyor"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {tr.note ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="pb-10" />
    </div>
  );
}
