"use client";
import { useActionState, useEffect, useRef } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addIdea, type ActionState } from "@/app/(app)/actions";

/** Pil "tambah ide cepat" di top bar: ketik judul ide lalu Enter. */
export function QuickIdea({ channelId }: { channelId: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addIdea, { ok: true, message: "" });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success("Ide masuk ke backlog");
      ref.current?.reset();
    } else toast.error(state.message);
  }, [state]);

  return (
    <form
      ref={ref}
      action={action}
      className="glass-strong group flex h-12 w-full max-w-xl items-center gap-3 rounded-full pr-1.5 pl-1.5 transition-shadow focus-within:ring-2 focus-within:ring-[var(--teal)]/40"
    >
      <span
        aria-hidden
        className="size-9 shrink-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,#fff_0%,#c9b8ff_30%,#7d6bf0_55%,#2fb5a8_100%)] shadow-[0_0_18px_-2px_rgb(125_107_240/0.7)] transition-transform group-focus-within:scale-110"
      />
      <input type="hidden" name="channel_id" value={channelId ?? ""} />
      <input
        name="title"
        required
        disabled={!channelId || pending}
        autoComplete="off"
        placeholder={channelId ? "Tulis ide video, tekan Enter untuk simpan ke backlog…" : "Buat kanal dulu untuk menyimpan ide"}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/50"
      />
      <button
        type="submit"
        aria-label="Simpan ide"
        disabled={!channelId || pending}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background transition-transform hover:scale-105 disabled:opacity-40"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
      </button>
    </form>
  );
}
