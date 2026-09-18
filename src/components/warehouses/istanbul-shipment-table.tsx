"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getWarehouseName,
  ISTANBUL_SHIPMENT_NEXT,
  transferStatusLabel,
  type IstanbulShipmentAction,
  type StockTransfer,
} from "@/data/warehouses";
import { advanceStockTransfer } from "@/lib/warehouse-store";
import { formatDate } from "@/lib/utils";

function statusVariant(status: string) {
  if (status === "completed") return "success" as const;
  if (status === "in_transit") return "warning" as const;
  if (status === "approved") return "info" as const;
  return "secondary" as const;
}

export function IstanbulShipmentTable({
  transfers,
  canAct,
  onChanged,
}: {
  transfers: StockTransfer[];
  canAct: boolean;
  onChanged?: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const rows = transfers.filter((row) => row.reason === "istanbul_shipment");

  async function run(id: string, action: IstanbulShipmentAction) {
    setBusyId(id);
    try {
      await advanceStockTransfer(id, action);
      toast.success(
        action === "approve"
          ? "Sevkiyat onaylandı"
          : action === "depart"
            ? "Sevkiyat yola çıktı"
            : "Ürün İstanbul deposuna geçti"
      );
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sevkiyat güncellenemedi");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ürün</TableHead>
          <TableHead>Kaynak</TableHead>
          <TableHead>Miktar</TableHead>
          <TableHead>Durum</TableHead>
          <TableHead>Tarih</TableHead>
          <TableHead className="text-right">İşlem</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
              İstanbul sevkiyatı yok
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => {
            const next = ISTANBUL_SHIPMENT_NEXT[row.status];
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.materialName}</TableCell>
                <TableCell className="text-sm">{getWarehouseName(row.fromWarehouseId)}</TableCell>
                <TableCell>
                  {row.quantity} {row.unit}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(row.status)}>
                    {transferStatusLabel(row.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(row.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  {canAct && next ? (
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-xl"
                      disabled={busyId === row.id}
                      onClick={() => void run(row.id, next.action)}
                    >
                      {next.label}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
