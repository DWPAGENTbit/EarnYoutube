import { LogOut } from "lucide-react";
import { Sidebar } from "@/components/app/sidebar";
import { ChannelSwitcher } from "@/components/app/channel-switcher";
import { getActiveChannel } from "@/lib/supabase/server";
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

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar
        reviewCount={reviewCount}
        channelSwitcher={<ChannelSwitcher channels={channels} activeId={channel?.id ?? null} />}
        footer={
          <form action={signOut} className="flex items-center justify-between gap-2 border-t border-white/15 pt-3">
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            <button aria-label="Keluar" className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white">
              <LogOut className="size-4" />
            </button>
          </form>
        }
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
