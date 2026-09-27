"use client";

import { use } from "react";
import { RawMaterialOrderDetail } from "@/components/raw-material-orders/raw-material-order-detail";

export default function RawMaterialTrackingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <RawMaterialOrderDetail id={id} mode="tracking" />;
}
