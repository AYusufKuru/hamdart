import { redirect } from "next/navigation";

export default function QuotesRedirectPage() {
  redirect("/invoices?tab=quotes");
}
