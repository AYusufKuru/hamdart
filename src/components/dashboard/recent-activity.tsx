"use client";



import { useEffect, useState } from "react";

import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { cn, formatDate } from "@/lib/utils";

import { getAllOrders } from "@/lib/order-store";

import { getAllProductionBatches } from "@/lib/production-store";

import { getAllLabExperiments } from "@/lib/lab-store";

import { getAllWarehouseStockItems, toDisplayStockItems } from "@/lib/stock-store";

import { getAllRawMaterialOrders } from "@/lib/raw-material-order-store";

import { AlertTriangle, Factory, FlaskConical, ShoppingCart, Warehouse } from "lucide-react";



const typeConfig = {

  production: { icon: Factory, color: "text-indigo-600 bg-indigo-500/10" },

  order: { icon: ShoppingCart, color: "text-blue-600 bg-blue-500/10" },

  alert: { icon: AlertTriangle, color: "text-amber-600 bg-amber-500/10" },

  lab: { icon: FlaskConical, color: "text-emerald-600 bg-emerald-500/10" },

  warehouse: { icon: Warehouse, color: "text-violet-600 bg-violet-500/10" },

};



type Activity = {

  id: string;

  time: string;

  message: string;

  type: keyof typeof typeConfig;

  sort: number;

  href: string;

};



async function buildLiveActivities(): Promise<Activity[]> {

  const [orders, batches, experiments, warehouseItems, rawMaterialOrders] =

    await Promise.all([

      getAllOrders(),

      getAllProductionBatches(),

      getAllLabExperiments(),

      getAllWarehouseStockItems(),

      getAllRawMaterialOrders(),

    ]);

  const stockItems = toDisplayStockItems(warehouseItems);

  const items: Activity[] = [];



  for (const o of orders.slice(0, 3)) {

    items.push({

      id: `ord-${o.id}`,

      time: formatDate(o.orderDate),

      message: `${o.orderNo} — ${o.customer}`,

      type: "order",

      sort: new Date(o.orderDate).getTime(),

      href: `/orders/${o.id}`,

    });

  }



  const batch = batches[0];

  if (batch) {

    items.push({

      id: `bat-${batch.id}`,

      time: formatDate(batch.startDate),

      message: `${batch.batchNo} · ${batch.product} (${batch.line})`,

      type: "production",

      sort: new Date(batch.startDate).getTime(),

      href: "/factory?tab=batches",

    });

  }



  const exp = experiments[0];

  if (exp) {

    items.push({

      id: `exp-${exp.id}`,

      time: formatDate(exp.startDate),

      message: `${exp.code} — ${exp.title}`,

      type: "lab",

      sort: new Date(exp.startDate).getTime(),

      href: "/rd-lab?tab=experiments",

    });

  }



  const alert = stockItems.find(

    (i) => i.status === "critical" || i.status === "low"

  );

  if (alert) {

    items.push({

      id: `stk-${alert.id}`,

      time: "Stok",

      message: `${alert.sku} stok ${alert.status === "critical" ? "kritik" : "düşük"} — ${alert.warehouse}`,

      type: "alert",

      sort: Date.now() - 1,

      href: alert.warehouseId ? `/warehouses/${alert.warehouseId}` : "/stock",

    });

  }



  const rmo = rawMaterialOrders.find((o) => o.status === "to_order");

  if (rmo) {

    items.push({

      id: `rmo-${rmo.id}`,

      time: formatDate(rmo.orderDate),

      message: `${rmo.orderNo} sipariş verilecek — ${rmo.materialName}`,

      type: "warehouse",

      sort: new Date(rmo.orderDate).getTime(),

      href: `/raw-material-orders/${rmo.id}`,

    });

  }



  return items.sort((a, b) => b.sort - a.sort).slice(0, 5);

}



export function RecentActivity() {

  const [activities, setActivities] = useState<Activity[]>([]);



  useEffect(() => {

    void buildLiveActivities().then(setActivities);

  }, []);



  return (

    <Card className="glass-card border-none">

      <CardHeader>

        <CardTitle>Son Aktiviteler</CardTitle>

      </CardHeader>

      <CardContent className="space-y-3">

        {activities.length === 0 ? (

          <p className="text-sm text-muted-foreground py-8 text-center">

            Henüz kayıtlı aktivite yok

          </p>

        ) : (

          activities.map((activity) => {

          const config = typeConfig[activity.type] ?? typeConfig.order;

          const Icon = config.icon;

          return (

            <Link

              key={activity.id}

              href={activity.href}

              className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors"

            >

              <div className={cn("p-2 rounded-lg shrink-0", config.color)}>

                <Icon className="w-4 h-4" />

              </div>

              <div className="flex-1 min-w-0">

                <p className="text-sm font-medium leading-snug">{activity.message}</p>

                <p className="text-[10px] text-muted-foreground mt-1 font-mono">{activity.time}</p>

              </div>

            </Link>

          );

        })

        )}

      </CardContent>

    </Card>

  );

}


