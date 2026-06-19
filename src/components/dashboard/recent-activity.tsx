"use client";

import { recentActivities } from "@/data/mock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangle, Factory, FlaskConical, ShoppingCart, Warehouse } from "lucide-react";

const typeConfig = {
  production: { icon: Factory, color: "text-indigo-600 bg-indigo-500/10" },
  order: { icon: ShoppingCart, color: "text-blue-600 bg-blue-500/10" },
  alert: { icon: AlertTriangle, color: "text-amber-600 bg-amber-500/10" },
  lab: { icon: FlaskConical, color: "text-emerald-600 bg-emerald-500/10" },
  warehouse: { icon: Warehouse, color: "text-violet-600 bg-violet-500/10" },
};

export function RecentActivity() {
  return (
    <Card className="glass-card border-none">
      <CardHeader>
        <CardTitle>Son Aktiviteler</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentActivities.map((activity) => {
          const config = typeConfig[activity.type as keyof typeof typeConfig];
          const Icon = config.icon;
          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors"
            >
              <div className={cn("p-2 rounded-lg shrink-0", config.color)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug">{activity.message}</p>
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">{activity.time}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
