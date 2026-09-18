import { redirect } from "next/navigation";

export default function FactoryHistoryPage() {
  redirect("/factory?tab=history");
}
