"use client";

import { Bell, Search, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

export function Navbar() {
  return (
    <header className="h-20 border-b bg-background/95 backdrop-blur-md px-10 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      <div className="relative w-full max-w-md hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Ürün, batch, sipariş veya numune ara..."
          className="pl-10 rounded-2xl bg-muted/30 border-border/50 h-11"
        />
      </div>

      <div className="flex items-center gap-6 ml-auto">
        <button className="p-2.5 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/5 rounded-2xl relative transition-all active:scale-95 group">
          <Bell className="w-5 h-5 group-hover:animate-bounce" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-indigo-500 rounded-full border-2 border-background ring-2 ring-indigo-500/20 animate-pulse" />
        </button>

        <div className="h-8 w-px bg-border/40" />

        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <div className="flex items-center gap-3.5 hover:bg-muted/80 p-1.5 pr-3 rounded-2xl transition-all cursor-pointer border border-transparent hover:border-border/40 hover:shadow-sm">
              <Avatar className="h-9 w-9 border-2 border-primary/10">
                <AvatarFallback>AY</AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-bold leading-none">Ayşe Yılmaz</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-bold opacity-70">
                  Üretim Müdürü
                </p>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2">
            <DropdownMenuLabel>Hesap</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              Profil Ayarları
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Bell className="w-4 h-4 mr-2" />
              Bildirimler
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
