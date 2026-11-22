import type { M3Output } from "../ai/schemas";
import type { VideoMetadata } from "./metadata";
import { SCRIPT_SIM_LIMIT, TITLE_SIM_LIMIT, mostSimilar } from "./similarity";
import type { Cue } from "./subtitles";

export interface QcCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}
export interface QcResult {
  passed: boolean;
  checks: QcCheck[];
  checked_at: string;
}

export interface QcInput {
  format: "long" | "short";
  targetDuration: number;
  duration: number;
  script: M3Output;
  voiceDurations: number[];
  sceneHasVisual: boolean[];
  blackSegments: { start: number; end: number }[];
  audioMaxDb: number | null;
  cues: Cue[];
  assetsMissingLicense: number;
  metadata: VideoMetadata;
  usedTts: boolean;
  previous: { id: string; title: string; script: string }[];
}

/** QC Checklist otomatis (Bagian 7 spesifikasi) sebelum masuk Review Queue. */
export function runQc(i: QcInput): QcResult {
  const checks: QcCheck[] = [];
  const add = (id: string, label: string, pass: boolean, detail: string) => checks.push({ id, label, pass, detail });

  // 1. Hook ≤ 5 detik: scene pertama = hook, dibacakan mulai 0 dtk.
  const hookDur = i.voiceDurations[0] ?? 0;
  add("hook", "Hook muncul ≤ 5 detik pertama", hookDur > 0 && hookDur <= 5.5, `Scene pembuka (hook) ${hookDur.toFixed(1)} dtk`);

  // 2. Durasi sesuai target & tidak ada scene kosong/hitam
  const maxShort = 60;
  const durOk =
    i.format === "short"
      ? i.duration <= maxShort
      : Math.abs(i.duration - i.targetDuration) <= Math.max(30, i.targetDuration * 0.25);
  add(
    "duration",
    "Durasi sesuai target",
    durOk,
    `${i.duration.toFixed(0)} dtk (target ${i.format === "short" ? `≤ ${maxShort}` : i.targetDuration} dtk)`,
  );
  const emptyScenes = i.sceneHasVisual.filter((v) => !v).length + i.voiceDurations.filter((d) => d <= 0).length;
  add(
    "no_black",
    "Tidak ada scene kosong/hitam",
    emptyScenes === 0 && i.blackSegments.length === 0,
    emptyScenes
      ? `${emptyScenes} scene tanpa visual/audio`
      : i.blackSegments.length
        ? `Layar hitam di ${i.blackSegments.map((b) => `${b.start.toFixed(1)}–${b.end.toFixed(1)}s`).join(", ")}`
        : "Semua scene punya visual",
  );

  // 3. Audio tidak clipping & subtitle sinkron
  add(
    "audio",
    "Audio tidak clipping",
    i.audioMaxDb !== null && i.audioMaxDb < -0.5,
    i.audioMaxDb === null ? "Volume tidak terbaca" : `Puncak ${i.audioMaxDb.toFixed(1)} dB`,
  );
  const lastCue = i.cues.at(-1);
  const subsOk = i.cues.length > 0 && !!lastCue && lastCue.end <= i.duration + 0.5 && i.cues.every((c) => c.end > c.start);
  add("subtitles", "Subtitle sinkron", subsOk, `${i.cues.length} baris, berakhir di ${lastCue?.end.toFixed(1) ?? "-"} dtk`);

  // 4. Lisensi aset
  add(
    "license",
    "Semua aset punya license_source",
    i.assetsMissingLicense === 0,
    i.assetsMissingLicense ? `${i.assetsMissingLicense} aset tanpa sumber lisensi` : "Lengkap",
  );

  // 5. Judul & deskripsi + chapters
  const m = i.metadata;
  add("title", "Judul ≤ 100 karakter", m.title.length > 0 && m.title.length <= 100, `${m.title.length} karakter`);
  const chaptersOk = i.format === "short" || m.chapters.length >= 3;
  add(
    "description",
    "Deskripsi + chapters lengkap",
    m.description.length >= 100 && chaptersOk,
    `${m.description.length} karakter, ${m.chapters.length} chapter`,
  );

  // 6. Disclosure AI
  add(
    "ai_disclosure",
    "Flag AI disclosure diset bila perlu",
    !i.usedTts || m.contains_synthetic_media,
    m.contains_synthetic_media ? "containsSyntheticMedia = true" : "Tidak diset",
  );

  // 7. Kemiripan dengan video sebelumnya
  const scriptText = i.script.scenes.map((s) => s.narration).join(" ");
  const sim = mostSimilar({ title: m.title, script: scriptText }, i.previous);
  const simOk = sim.titleSim < TITLE_SIM_LIMIT && sim.scriptSim < SCRIPT_SIM_LIMIT;
  add(
    "similarity",
    "Tidak terlalu mirip video sebelumnya",
    simOk,
    i.previous.length
      ? `Kemiripan judul ${(sim.titleSim * 100).toFixed(0)}%, skrip ${(sim.scriptSim * 100).toFixed(0)}%`
      : "Belum ada video pembanding",
  );

  return { passed: checks.every((c) => c.pass), checks, checked_at: new Date().toISOString() };
}
