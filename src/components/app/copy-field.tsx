"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

/** Teks yang bisa disalin dengan satu klik (mis. Redirect URI). */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/60 py-1.5 pr-1.5 pl-3.5 shadow-sm">
      <code className="min-w-0 flex-1 truncate font-mono text-xs" title={value}>
        {value}
      </code>
      <button
        type="button"
        aria-label={label ?? "Salin"}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setDone(true);
            toast.success("Disalin ke clipboard");
            setTimeout(() => setDone(false), 1600);
          } catch {
            toast.error("Gagal menyalin. Salin manual teks di sebelahnya.");
          }
        }}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-medium text-background transition-transform active:scale-95"
      >
        {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {done ? "Tersalin" : "Salin"}
      </button>
    </div>
  );
}
