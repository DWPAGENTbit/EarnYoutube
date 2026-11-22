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
        className="flex items-center gap-2 rounded-md border border-dashed px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted"
      >
        <Plus className="size-4" /> Buat kanal
      </Link>
    );
  }
  return (
    <div className="space-y-1">
      <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Kanal</p>
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
        <SelectTrigger className="w-full">
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
