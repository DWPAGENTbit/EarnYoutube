export interface Cue {
  start: number;
  end: number;
  text: string;
  scene: number;
}

/**
 * Bagi narasi tiap scene menjadi potongan ±7 kata. Waktu dibagi sesuai
 * panjang karakter di dalam durasi audio scene tersebut, sehingga subtitle
 * selalu sinkron dengan voice-over per scene.
 */
export function buildCues(scenes: { narration: string; start: number; voiceDuration: number }[], wordsPerCue = 7): Cue[] {
  const cues: Cue[] = [];
  scenes.forEach((s, idx) => {
    const words = s.narration.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += wordsPerCue) chunks.push(words.slice(i, i + wordsPerCue).join(" "));
    const total = chunks.reduce((a, c) => a + c.length, 0) || 1;
    let t = s.start;
    for (const c of chunks) {
      const d = (c.length / total) * s.voiceDuration;
      cues.push({ start: t, end: t + d, text: c, scene: idx });
      t += d;
    }
  });
  return cues;
}

const ts = (sec: number) => {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
};

export function toSrt(cues: Cue[]) {
  return cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n");
}
