import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { BottomTabs, Brand, MobileMenu, Rail } from "@/components/app/shell";
import { ChannelSwitcher } from "@/components/app/channel-switcher";
import { QuickIdea } from "@/components/app/quick-idea";
import { getActiveChannel } from "@/lib/supabase/server";
import { displayName } from "@/lib/greeting";
import { signOut } from "../(auth)/login/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase, user, channel, channels } = await getActiveChannel();
  let reviewCount = 0;
  if (channel) {
    const { count } = await supabase
      .from("videos")
      .select("id", { count: "exact", head: true })
      .eq("channel_id", channel.id)
      .eq("status", "review");
    reviewCount = count ?? 0;
  }
  const name = displayName(user.email);
  const switcher = <ChannelSwitcher channels={channels} activeId={channel?.id ?? null} />;
  const signOutButton = (
    <form action={signOut}>
      <button
        aria-label="Keluar"
        title="Keluar"
        className="grid size-10 place-items-center rounded-full bg-white/70 text-foreground/70 shadow-sm transition-colors hover:bg-white hover:text-foreground"
      >
        <LogOut className="size-4" />
      </button>
    </form>
  );

  return (
    <div className="min-h-dvh px-2.5 pt-2.5 pb-28 md:px-5 md:pt-4">
      {/* Top bar kaca */}
      <header className="glass sticky top-2.5 z-30 flex h-16 items-center gap-3 rounded-full px-3 md:top-4 md:px-4">
        <div className="flex min-w-0 items-center gap-3 md:w-72">
          <Brand withName={false} />
          <span
            aria-hidden
            className="hidden size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#3a3330] to-[#6b5a4c] text-sm font-semibold text-white shadow-md sm:grid"
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
          <p className="truncate text-sm font-semibold">
            <span className="hidden font-normal text-foreground/60 sm:inline">Selamat datang, </span>
            {name}
          </p>
        </div>
        <div className="hidden flex-1 justify-center lg:flex">
          <QuickIdea channelId={channel?.id ?? null} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden w-48 sm:block">{switcher}</div>
          <Link
            href="/review"
            aria-label={`Review Queue (${reviewCount})`}
            className="relative grid size-10 place-items-center rounded-full bg-white shadow-[0_6px_16px_-8px_rgb(60_40_20/0.55)] transition-transform hover:scale-105"
          >
            <Bell className="size-[18px]" />
            {reviewCount > 0 && (
              <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-[#e5484d] ring-2 ring-white" />
            )}
          </Link>
          <div className="hidden md:block">{signOutButton}</div>
          <MobileMenu
            footer={
              <div className="space-y-3">
                {switcher}
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  {signOutButton}
                </div>
              </div>
            }
          />
        </div>
      </header>

      <div className="mt-3 flex gap-3 md:mt-4 md:gap-4">
        <Rail reviewCount={reviewCount} />
        <main className="glass min-w-0 flex-1 rounded-[32px] px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      <BottomTabs />
    </div>
  );
}
