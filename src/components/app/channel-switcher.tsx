"use client";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { selectChannel } from "@/app/(app)/actions";

export function ChannelSwitcher({
  channels,
  activeId,
}: {
  channels: { id: string; name: string; yt_channel_title: string | null }[];
  activeId: string | null;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!channels.length) {
    return (
      <Link
        href="/channel"
        className="flex h-10 items-center gap-2 rounded-full border border-dashed border-foreground/25 bg-white/50 px-4 text-sm text-foreground/70 hover:bg-white/80"
      >
        <Plus className="size-4" /> Buat kanal
      </Link>
    );
  }
  return (
    <div>
      <Select
        value={activeId ?? undefined}
        disabled={pending}
        onValueChange={(v) => {
          if (v === "__new") {
            router.push("/channel?new=1");
            return;
          }
          start(() => selectChannel(v));
        }}
      >
        <SelectTrigger aria-label="Pilih kanal" className="w-full rounded-full border-white/80 bg-white/70 px-4 shadow-sm data-[size=default]:h-10">
          <SelectValue placeholder="Pilih kanal" />
        </SelectTrigger>
        <SelectContent>
          {channels.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.yt_channel_title ?? c.name}
            </SelectItem>
          ))}
          <SelectItem value="__new">+ Kanal baru</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
