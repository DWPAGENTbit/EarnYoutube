import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ffmpeg, probeDuration } from "./ffmpeg";
import { captionPng, headlinePng } from "./graphics";
import type { Cue } from "./subtitles";

export interface RenderScene {
  visualFile: string; // path absolut
  visualKind: "video" | "image";
  voiceFile: string;
  voiceDuration: number;
  onScreenText: string;
}

export const SIZES = {
  long: { w: 1920, h: 1080 },
  short: { w: 1080, h: 1920 },
} as const;

const PAD_SEC = 0.35; // jeda kecil antar scene

/**
 * Render video lengkap dengan FFmpeg:
 * 1) tiap scene → segmen MP4 (visual di-scale/crop, Ken Burns untuk gambar,
 *    teks layar + subtitle sebagai overlay PNG, audio voice-over),
 * 2) segmen digabung (concat),
 * 3) loudness dinormalisasi (-14 LUFS, true peak -1.5 dB) agar tidak clipping.
 */
export async function renderVideo(opts: {
  workdir: string;
  format: "long" | "short";
  scenes: RenderScene[];
  cues: Cue[];
  log?: (m: string) => void;
}): Promise<{ file: string; duration: number; sceneStarts: number[] }> {
  const { workdir, format, scenes, cues } = opts;
  const { w: W, h: H } = SIZES[format];
  const segs: string[] = [];
  const sceneStarts: number[] = [];
  let t0 = 0;

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const D = +(s.voiceDuration + PAD_SEC).toFixed(3);
    sceneStarts.push(t0);
    const overlays: { file: string; from: number; to: number }[] = [];
    if (s.onScreenText.trim()) {
      const f = path.join(workdir, `hl_${i}.png`);
      await writeFile(f, await headlinePng(s.onScreenText, W, H));
      overlays.push({ file: f, from: 0, to: Math.min(D, 4.5) });
    }
    const sceneCues = cues.filter((c) => c.scene === i);
    for (let k = 0; k < sceneCues.length; k++) {
      const c = sceneCues[k];
      const f = path.join(workdir, `cap_${i}_${k}.png`);
      await writeFile(f, await captionPng(c.text, W, H));
      overlays.push({ file: f, from: c.start - t0, to: c.end - t0 });
    }

    const args: string[] = [];
    if (s.visualKind === "video") args.push("-stream_loop", "-1", "-i", s.visualFile);
    else args.push("-loop", "1", "-framerate", "30", "-i", s.visualFile);
    args.push("-i", s.voiceFile);
    for (const o of overlays) args.push("-i", o.file);

    const frames = Math.ceil(D * 30);
    const bg =
      s.visualKind === "video"
        ? `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30[v0]`
        : `[0:v]scale=${Math.round(W * 1.2)}:${Math.round(H * 1.2)}:force_original_aspect_ratio=increase,crop=${Math.round(W * 1.2)}:${Math.round(H * 1.2)},` +
          `zoompan=z='min(zoom+${(0.12 / frames).toFixed(5)},1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=30,setsar=1[v0]`;
    const chain = [bg];
    overlays.forEach((o, k) => {
      chain.push(
        `[v${k}][${k + 2}:v]overlay=0:0:enable='between(t,${o.from.toFixed(3)},${o.to.toFixed(3)})'[v${k + 1}]`,
      );
    });
    chain.push(`[v${overlays.length}]format=yuv420p[vout]`);
    chain.push(`[1:a]aresample=48000,apad[aout]`);

    const seg = `seg_${String(i).padStart(3, "0")}.mp4`;
    await ffmpeg(
      [
        ...args,
        "-filter_complex", chain.join(";"),
        "-map", "[vout]", "-map", "[aout]",
        "-t", String(D),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-r", "30",
        "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000",
        seg,
      ],
      workdir,
    );
    segs.push(seg);
    t0 += D;
    opts.log?.(`scene ${i + 1}/${scenes.length} dirender (${D.toFixed(1)} dtk)`);
  }

  await writeFile(path.join(workdir, "list.txt"), segs.map((s) => `file '${s}'`).join("\n"));
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "concat.mp4"], workdir);
  await ffmpeg(
    [
      "-i", "concat.mp4",
      "-c:v", "copy",
      "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
      "-movflags", "+faststart",
      "final.mp4",
    ],
    workdir,
  );
  const file = path.join(workdir, "final.mp4");
  return { file, duration: await probeDuration(file), sceneStarts };
}

/** Ambil satu frame dari klip (untuk latar thumbnail). */
export async function extractFrame(videoFile: string, out: string, atSec = 1) {
  await ffmpeg(["-ss", String(atSec), "-i", videoFile, "-frames:v", "1", "-q:v", "2", out]);
  return out;
}

/** Hitung waktu mulai cue dari durasi voice per scene (harus sama dengan render). */
export function sceneTimeline(voiceDurations: number[]) {
  const starts: number[] = [];
  let t = 0;
  for (const d of voiceDurations) {
    starts.push(t);
    t += d + PAD_SEC;
  }
  return { starts, total: t };
}
