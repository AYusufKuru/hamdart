"use client";

import type { ProductionBatch } from "@/data/mock";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  batchMaterialRows,
  formatUsagePercent,
  formatVariance,
  recipeUsagePercent,
} from "@/lib/batch-material-report";
import { formatDate, formatNumber } from "@/lib/utils";

const statusLabel = {
  completed: { label: "Tamamlandı", variant: "success" as const },
  rejected: { label: "Reddedildi", variant: "danger" as const },
};

export function BatchHistoryDetail({ batch }: { batch: ProductionBatch }) {
  const rows = batchMaterialRows(batch.materialUsage);
  const usagePct = recipeUsagePercent(batch.materialUsage);
  const status =
    batch.status === "rejected"
      ? statusLabel.rejected
      : statusLabel.completed;

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-5 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">
              {batch.batchNo}
            </p>
            <h3 className="mt-1 text-xl font-black">{batch.product}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Hat: {batch.line} · {formatNumber(batch.quantity)} {batch.unit}
            </p>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Başlangıç
            </p>
            <p className="mt-1 font-bold">{formatDate(batch.startDate)}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Bitiş
            </p>
            <p className="mt-1 font-bold">{formatDate(batch.endDate)}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Verim
            </p>
            <p className="mt-1 font-bold">%{formatNumber(batch.yield)}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Reçete kullanımı
            </p>
            <p className="mt-1 font-bold">{formatUsagePercent(usagePct)}</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Reçeteye göre gitmesi gereken (tahmini) ile KK’da girilen gerçekleşen
          miktarlar karşılaştırılır. %100 = reçete kadar kullanıldı; üzeri fazla,
          altı eksik tüketimdir.
        </p>

        <Separator />

        <section>
          <h4 className="mb-3 text-sm font-black">Hammadde detayı</h4>
          {rows.length > 0 ? (
            <ul className="space-y-2">
              {rows.map((row, i) => (
                <li
                  key={`${row.materialName}-${row.unit}-${i}`}
                  className="rounded-xl border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-bold">{row.materialName}</p>
                    <Badge
                      variant={
                        row.percentOfRecipe == null
                          ? "secondary"
                          : row.percentOfRecipe > 105
                            ? "warning"
                            : row.percentOfRecipe < 95
                              ? "info"
                              : "success"
                      }
                    >
                      {formatUsagePercent(row.percentOfRecipe)}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Reçete (tahmini)</p>
                      <p className="font-semibold">
                        {formatNumber(row.estimated)} {row.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Gerçekleşen</p>
                      <p className="font-semibold">
                        {row.actual !== null
                          ? `${formatNumber(row.actual)} ${row.unit}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Fark</p>
                      <p className="font-semibold">
                        {formatVariance(row.variance, row.unit)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Bu parti için hammadde kullanım kaydı yok.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
