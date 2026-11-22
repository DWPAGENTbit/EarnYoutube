import { CheckCircle2, XCircle } from "lucide-react";
import type { QcResult } from "@/lib/pipeline/qc";

export function QcList({ qc }: { qc: QcResult }) {
  return (
    <ul className="space-y-2 text-sm">
      {qc.checks.map((c) => (
        <li key={c.id} className="flex gap-2">
          {c.pass ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          )}
          <div>
            <p className={c.pass ? "" : "font-medium"}>{c.label}</p>
            <p className="text-xs text-muted-foreground">{c.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
