"use client";

import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { UserMenu } from "@/components/layout/user-menu";
import { SidebarBrand, SidebarNav, SidebarStreak } from "@/components/layout/app-sidebar";

interface HeaderProps {
  streakDays: number;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
}

/** Cabeçalho da área autenticada (com menu mobile). */
export function AppHeader({
  streakDays,
  userName,
  userEmail,
  userImage,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        {/* Menu mobile */}
        <Sheet>
          <SheetTrigger asChild>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <div className="flex h-full flex-col">
              <SidebarBrand />
              <SidebarStreak days={streakDays} />
              <SidebarNav />
            </div>
          </SheetContent>
        </Sheet>

        <p className="text-sm font-medium text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      <UserMenu name={userName} email={userEmail} image={userImage} />
    </header>
  );
}
