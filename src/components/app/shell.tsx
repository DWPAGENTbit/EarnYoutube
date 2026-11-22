"use client";
import Image from "next/image";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Clapperboard,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Loader2,
  Menu,
  Plus,
  Settings,
  Tv,
  X,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", short: "Ringkasan", icon: LayoutDashboard },
  { href: "/channel", label: "Channel Setup", short: "Kanal", icon: Tv },
  { href: "/ideas", label: "Idea Backlog", short: "Ide", icon: Lightbulb },
  { href: "/studio", label: "Studio", short: "Studio", icon: Clapperboard },
  { href: "/review", label: "Review Queue", short: "Review", icon: ListChecks },
  { href: "/scheduler", label: "Scheduler", short: "Jadwal", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", short: "Analitik", icon: BarChart3 },
  { href: "/monetization", label: "Monetization", short: "Monetisasi", icon: CircleDollarSign },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings },
] as const;

/** Halaman alur kerja utama di tab bawah. */
const TABS = ["/dashboard", "/ideas", "/studio", "/review", "/scheduler", "/analytics"];

function useActive() {
  const path = usePathname();
  return (href: string) => path === href || path.startsWith(`${href}/`);
}

/** Garis progres di atas layar selama pindah halaman (dipasang di dalam Link). */
function PendingBar() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return createPortal(<div className="ey-nav-progress" role="progressbar" aria-label="Memuat halaman" />, document.body);
}

function PendingSpinner({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <>
      <Loader2 aria-hidden className={cn("animate-spin", className)} />
      {createPortal(<div className="ey-nav-progress" role="progressbar" aria-label="Memuat halaman" />, document.body)}
    </>
  );
}

/** Rail ikon vertikal (desktop), seperti dock kaca. */
export function Rail({ reviewCount }: { reviewCount: number }) {
  const isActive = useActive();
  return (
    <nav aria-label="Navigasi utama" className="glass sticky top-24 hidden h-fit flex-col items-center gap-1 rounded-full p-2 md:flex">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Tooltip key={href}>
            <TooltipTrigger asChild>
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative grid size-11 place-items-center rounded-full transition-all duration-200",
                  active
                    ? "bg-white text-foreground shadow-[0_6px_16px_-8px_rgb(60_40_20/0.55)]"
                    : "text-foreground/65 hover:bg-white/60 hover:text-foreground",
                )}
              >
                <Icon className="size-[18px]" />
                <span className="absolute inset-0 grid place-items-center rounded-full bg-white/80 empty:hidden">
                  <PendingSpinner className="size-4 text-[var(--teal-deep)]" />
                </span>
                {href === "/review" && reviewCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--teal)] px-1 text-[10px] font-semibold text-white">
                    {reviewCount}
                  </span>
                )}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

/** Tab pil mengambang di bawah layar. */
export function BottomTabs() {
  const isActive = useActive();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3">
      <nav
        aria-label="Alur kerja"
        className="glass pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full p-1.5 [scrollbar-width:none]"
      >
        {NAV.filter((n) => TABS.includes(n.href)).map(({ href, short }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm transition-all duration-200",
                active
                  ? "bg-white font-semibold text-foreground shadow-[0_6px_16px_-8px_rgb(60_40_20/0.55)]"
                  : "text-foreground/70 hover:bg-white/50 hover:text-foreground",
              )}
            >
              {short}
              <PendingSpinner className="size-3.5" />
            </Link>
          );
        })}
        <Link
          href="/ideas?add=1"
          aria-label="Tambah ide"
          className="ml-1 grid size-10 shrink-0 place-items-center rounded-full bg-white text-foreground shadow-[0_6px_16px_-8px_rgb(60_40_20/0.55)] transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="size-5" />
          <PendingBar />
        </Link>
      </nav>
    </div>
  );
}

/** Menu lengkap untuk layar kecil. */
export function MobileMenu({ footer }: { footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const isActive = useActive();
  return (
    <>
      <button
        aria-label="Buka menu"
        onClick={() => setOpen(true)}
        className="grid size-10 place-items-center rounded-full bg-white/70 shadow-sm md:hidden"
      >
        <Menu className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-[#3b2f25]/25 backdrop-blur-sm animate-in fade-in" onClick={() => setOpen(false)} />
          <aside className="glass-strong absolute inset-y-2 left-2 flex w-[min(20rem,calc(100vw-1rem))] flex-col gap-4 rounded-[28px] p-4 animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between">
              <Brand />
              <button aria-label="Tutup menu" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full hover:bg-white/60">
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm",
                    isActive(href) ? "bg-white font-semibold shadow-sm" : "text-foreground/75 hover:bg-white/50",
                  )}
                >
                  <Icon className="size-[18px]" />
                  <span className="flex-1">{label}</span>
                  <PendingSpinner className="size-4" />
                </Link>
              ))}
            </nav>
            <div className="mt-auto">{footer}</div>
          </aside>
        </div>
      )}
    </>
  );
}

export function Brand({ withName = true }: { withName?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <span className="grid size-10 place-items-center rounded-full bg-white shadow-[0_6px_16px_-8px_rgb(60_40_20/0.5)]">
        <Image src="/logo.png" alt="EarnYoutube" width={26} height={26} priority />
      </span>
      {withName && <span className="text-[15px] font-semibold tracking-tight">EarnYoutube</span>}
    </Link>
  );
}
