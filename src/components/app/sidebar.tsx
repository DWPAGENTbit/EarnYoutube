"use client";
import Image from "next/image";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  CalendarDays,
  Clapperboard,
  CircleDollarSign,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Loader2,
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

/** Indikator saat menu diklik: spinner di menu + garis progres di atas layar. */
function NavPending() {
  const { pending } = useLinkStatus();
  // pending hanya true di browser (setelah klik), jadi document pasti ada.
  if (!pending) return null;
  return (
    <>
      <Loader2 aria-hidden className="size-3.5 animate-spin text-[var(--brand-cyan)]" />
      {createPortal(<div className="ey-nav-progress" role="progressbar" aria-label="Memuat halaman" />, document.body)}
    </>
  );
}

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
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-200",
              active
                ? "bg-white/18 font-medium text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22)]"
                : "text-white/75 hover:translate-x-0.5 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-4" />
            <span className="flex-1">{label}</span>
            <NavPending />
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
      <span className="grid size-9 place-items-center rounded-xl bg-white shadow-md">
        <Image src="/logo.png" alt="EarnYoutube" width={26} height={26} priority />
      </span>
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
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-5 border-r border-white/15 bg-sidebar px-3 py-4 backdrop-blur-xl md:flex">
        <Brand />
        {channelSwitcher}
        <NavLinks reviewCount={reviewCount} />
        <div className="mt-auto">{footer}</div>
      </aside>

      {/* Mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/15 bg-[var(--bg-mid)]/80 px-4 py-2.5 backdrop-blur-xl md:hidden">
        <Brand />
        <button aria-label="Buka menu" onClick={() => setOpen(true)} className="rounded-md p-1.5 hover:bg-muted">
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-[#0b1d45]/50 backdrop-blur-sm animate-in fade-in" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col gap-5 bg-gradient-to-b from-[var(--bg-mid)] to-[var(--bg-to)] px-3 py-4 shadow-2xl animate-in slide-in-from-left duration-300">
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
