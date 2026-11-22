import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

export const FFMPEG = process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string);
export const FFPROBE = process.env.FFPROBE_PATH || ffprobeStatic.path;

export function run(bin: string, args: string[], opts: { cwd?: string } = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { cwd: opts.cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => {
      stderr += d;
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
    });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin.split(/[\\/]/).pop()} keluar dengan kode ${code}: ${stderr.slice(-1500)}`));
    });
  });
}

export const ffmpeg = (args: string[], cwd?: string) => run(FFMPEG, ["-hide_banner", "-y", ...args], { cwd });

export async function probeDuration(file: string): Promise<number> {
  const { stdout } = await run(FFPROBE, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const d = Number(stdout.trim());
  if (!Number.isFinite(d)) throw new Error(`Durasi tidak terbaca: ${file}`);
  return d;
}

/** Deteksi bagian hitam ≥ 1 detik. */
export async function detectBlack(file: string) {
  const { stderr } = await ffmpeg(["-i", file, "-vf", "blackdetect=d=1:pix_th=0.10", "-an", "-f", "null", "-"]);
  return [...stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => ({
    start: Number(m[1]),
    end: Number(m[2]),
  }));
}

/** Puncak & rata-rata volume audio (dB). */
export async function detectVolume(file: string) {
  const { stderr } = await ffmpeg(["-i", file, "-vn", "-af", "volumedetect", "-f", "null", "-"]);
  const max = stderr.match(/max_volume: (-?[\d.]+) dB/);
  const mean = stderr.match(/mean_volume: (-?[\d.]+) dB/);
  return { maxDb: max ? Number(max[1]) : null, meanDb: mean ? Number(mean[1]) : null };
}
