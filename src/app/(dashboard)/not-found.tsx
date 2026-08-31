import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="p-10 min-h-[60vh] flex flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-black tracking-tight">Kayıt bulunamadı</h1>
      <p className="text-muted-foreground mt-2 max-w-md">
        İstediğiniz sipariş, depo veya sayfa yok ya da silinmiş olabilir.
      </p>
      <Button
        className="mt-8 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
        asChild
      >
        <Link href="/dashboard">Dashboard’a dön</Link>
      </Button>
    </div>
  );
}
