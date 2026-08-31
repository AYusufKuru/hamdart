import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-10 text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-3">
        HamdPharma
      </p>
      <h1 className="text-3xl font-black tracking-tight">Sayfa bulunamadı</h1>
      <p className="text-muted-foreground mt-2 max-w-md">
        Bu adres sistemde yok. Dashboard’dan devam edebilirsiniz.
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
