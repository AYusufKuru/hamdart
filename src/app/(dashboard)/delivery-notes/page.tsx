import { redirect } from "next/navigation";

export default function DeliveryNotesRedirectPage() {
  redirect("/invoices?tab=delivery");
}
