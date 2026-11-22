// Kemiripan teks sederhana (Jaccard atas shingle kata) untuk mencegah
// video yang terlalu mirip dengan video sebelumnya di kanal yang sama.

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

function shingles(s: string, n: number): Set<string> {
  const w = norm(s).split(" ").filter(Boolean);
  const out = new Set<string>();
  if (w.length < n) {
    if (w.length) out.add(w.join(" "));
    return out;
  }
  for (let i = 0; i <= w.length - n; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

export function jaccard(a: string, b: string, n = 2): number {
  const A = shingles(a, n);
  const B = shingles(b, n);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export const TITLE_SIM_LIMIT = 0.6;
export const SCRIPT_SIM_LIMIT = 0.35;

export function mostSimilar(
  candidate: { title: string; script: string },
  previous: { id: string; title: string; script: string }[],
) {
  let best = { id: "", titleSim: 0, scriptSim: 0 };
  for (const p of previous) {
    const titleSim = jaccard(candidate.title, p.title, 1);
    const scriptSim = jaccard(candidate.script, p.script, 3);
    if (titleSim + scriptSim > best.titleSim + best.scriptSim) best = { id: p.id, titleSim, scriptSim };
  }
  return best;
}
