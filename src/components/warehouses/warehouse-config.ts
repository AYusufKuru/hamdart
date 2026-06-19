import { Beaker, Factory, Package } from "lucide-react";
import type { WarehouseType } from "@/data/warehouses";

export const warehouseTypeConfig: Record<
  WarehouseType,
  {
    icon: typeof Package;
    color: string;
    badge: "info" | "warning" | "success";
    badgeClassName: string;
  }
> = {
  packaging: {
    icon: Package,
    color: "from-blue-500/10 to-indigo-500/5",
    badge: "info",
    badgeClassName: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  production: {
    icon: Factory,
    color: "from-amber-500/10 to-orange-500/5",
    badge: "warning",
    badgeClassName: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  },
  laboratory: {
    icon: Beaker,
    color: "from-violet-500/10 to-purple-500/5",
    badge: "success",
    badgeClassName: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  },
};
