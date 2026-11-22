"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Clapperboard,
  CircleDollarSign,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Menu,
  Settings,
  Tv,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/channel", label: "Channel Setup", icon: Tv },
  { href: "/ideas", label: "Idea Backlog", icon: Lightbulb },
  { href: "/studio", label: "Studio", icon: Clapperboard },
  { href: "/review", label: "Review Queue", icon: ListChecks },
  { href: "/scheduler", label: "Scheduler", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/monetization", label: "Monetization", icon: CircleDollarSign },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function NavLinks({ reviewCount, onNavigate }: { reviewCount: number; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className="flex-1">{label}</span>
            {href === "/review" && reviewCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
                {reviewCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-1">
      <Image src="/logo.png" alt="EarnYoutube" width={30} height={30} priority />
      <span className="text-[15px] font-semibold tracking-tight">EarnYoutube</span>
    </Link>
  );
}

export function Sidebar({
  reviewCount,
  channelSwitcher,
  footer,
}: {
  reviewCount: number;
  channelSwitcher: React.ReactNode;
  footer: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-5 border-r bg-sidebar px-3 py-4 md:flex">
        <Brand />
        {channelSwitcher}
        <NavLinks reviewCount={reviewCount} />
        <div className="mt-auto">{footer}</div>
      </aside>

      {/* Mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-2.5 backdrop-blur md:hidden">
        <Brand />
        <button aria-label="Buka menu" onClick={() => setOpen(true)} className="rounded-md p-1.5 hover:bg-muted">
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col gap-5 bg-background px-3 py-4 shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button aria-label="Tutup menu" onClick={() => setOpen(false)} className="rounded-md p-1.5 hover:bg-muted">
                <X className="size-5" />
              </button>
            </div>
            {channelSwitcher}
            <NavLinks reviewCount={reviewCount} onNavigate={() => setOpen(false)} />
            <div className="mt-auto">{footer}</div>
          </aside>
        </div>
      )}
    </>
  );
}
