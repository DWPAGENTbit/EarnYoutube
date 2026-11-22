import type { M3Output } from "../ai/schemas";

export interface VideoMetadata {
  title: string;
  title_options: string[];
  description: string;
  tags: string[];
  chapters: { start: number; title: string }[];
  categoryId: string;
  defaultLanguage: string;
  contains_synthetic_media: boolean;
  thumbnail_options: string[]; // ref storage
  credits: string[];
}

export const fmtTime = (sec: number) => {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};

/**
 * Chapters YouTube: mulai 0:00, minimal 3, masing-masing ≥ 10 detik.
 * Chapter yang terlalu pendek digabung ke chapter sebelumnya.
 */
export function buildChapters(script: M3Output, sceneStarts: number[], total: number) {
  const raw = script.scenes
    .map((s, i) => ({ start: sceneStarts[i] ?? 0, title: s.chapter_title.trim() }))
    .filter((c, i) => i === 0 || c.title);
  if (!raw.length || raw[0].start !== 0) raw.unshift({ start: 0, title: "Intro" });
  if (!raw[0].title) raw[0].title = "Intro";
  const out: { start: number; title: string }[] = [];
  for (const c of raw) {
    const prev = out.at(-1);
    if (prev && c.start - prev.start < 10) continue;
    out.push(c);
  }
  while (out.length > 1 && total - out.at(-1)!.start < 10) out.pop();
  return out.length >= 3 ? out : [];
}

export function buildMetadata(opts: {
  script: M3Output;
  format: "long" | "short";
  sceneStarts: number[];
  duration: number;
  credits: string[];
  language: string;
  categoryId?: string;
  containsSyntheticMedia: boolean;
  thumbnailOptions: string[];
}): VideoMetadata {
  const { script, format } = opts;
  const chapters = format === "long" ? buildChapters(script, opts.sceneStarts, opts.duration) : [];
  const title = format === "short" ? script.shorts_cut.title || script.titles[0] : script.titles[0];
  const parts = [script.description.trim()];
  if (chapters.length) parts.push(chapters.map((c) => `${fmtTime(c.start)} ${c.title}`).join("\n"));
  if (opts.credits.length) parts.push(`Kredit footage (lisensi bebas royalti):\n${Array.from(new Set(opts.credits)).join("\n")}`);
  if (opts.containsSyntheticMedia) parts.push("Video ini menggunakan narasi suara sintetis (AI).");
  const tags = Array.from(new Set(script.tags.map((t) => t.trim()).filter(Boolean)));
  // Batas total tag YouTube ±500 karakter.
  const trimmedTags: string[] = [];
  let len = 0;
  for (const t of tags) {
    if (len + t.length + 1 > 480) break;
    trimmedTags.push(t);
    len += t.length + 1;
  }
  return {
    title: (format === "short" && !title.includes("#Shorts") ? `${title} #Shorts` : title).slice(0, 100),
    title_options: script.titles,
    description: parts.join("\n\n").slice(0, 4900),
    tags: trimmedTags,
    chapters,
    categoryId: opts.categoryId ?? "27",
    defaultLanguage: opts.language,
    contains_synthetic_media: opts.containsSyntheticMedia,
    thumbnail_options: opts.thumbnailOptions,
    credits: opts.credits,
  };
}
