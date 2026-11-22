/**
 * EarnYoutube worker — mengambil job dari tabel `jobs` dan menjalankannya.
 *
 *   npm run worker            # loop terus-menerus
 *   npm run worker -- --once  # proses job yang ada lalu keluar
 *
 * Variabel: WORKER_ID, WORKER_STAGES (mis. "rendering,qc"), WORKER_POLL_MS.
 * Jalankan beberapa worker sekaligus bila perlu; pengambilan job aman
 * (FOR UPDATE SKIP LOCKED di fungsi claim_next_job).
 */
import { config as loadEnv } from "dotenv";
import os from "node:os";
import { adminClient } from "../src/lib/supabase/admin";
import { DeferError, STAGE_HANDLERS } from "../src/lib/pipeline/stages";
import type { Job } from "../src/lib/types";

// .env.local diutamakan, lalu .env (variabel dibaca saat dipakai, bukan saat impor).
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const WORKER_ID = process.env.WORKER_ID ?? `${os.hostname()}-${process.pid}`;
const STAGES = process.env.WORKER_STAGES?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 5000);
const ONCE = process.argv.includes("--once");

let stopping = false;
process.on("SIGINT", () => {
  console.log("\nMenyelesaikan job aktif lalu berhenti…");
  stopping = true;
});

async function claim(): Promise<Job | null> {
  const { data, error } = await adminClient().rpc("claim_next_job", { worker_id: WORKER_ID, stages: STAGES });
  if (error) throw new Error(`claim_next_job: ${error.message}`);
  return (data as Job[] | null)?.[0] ?? null;
}

async function processJob(job: Job) {
  const db = adminClient();
  const logs: { t: string; m: string }[] = [...(job.logs ?? [])];
  const log = (m: string) => {
    const entry = { t: new Date().toISOString(), m };
    logs.push(entry);
    console.log(`[${job.stage}${job.video_id ? ` ${job.video_id.slice(0, 8)}` : ""}] ${m}`);
  };
  log(`mulai (percobaan ${job.attempts}/${job.max_attempts})`);
  try {
    await STAGE_HANDLERS[job.stage]({ job, log });
    log("selesai");
    await db.from("jobs").update({ status: "done", error: null, logs, locked_at: null }).eq("id", job.id);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (e instanceof DeferError) {
      log(`ditunda sampai ${e.runAfter.toISOString()}: ${msg}`);
      await db
        .from("jobs")
        .update({ status: "queued", run_after: e.runAfter.toISOString(), attempts: job.attempts - 1, logs, error: msg, locked_at: null })
        .eq("id", job.id);
      return;
    }
    log(`GAGAL: ${msg}`);
    if (job.attempts < job.max_attempts) {
      const backoffMin = 2 ** job.attempts; // 2, 4, 8 menit
      await db
        .from("jobs")
        .update({
          status: "queued",
          run_after: new Date(Date.now() + backoffMin * 60_000).toISOString(),
          error: msg,
          logs,
          locked_at: null,
        })
        .eq("id", job.id);
    } else {
      await db.from("jobs").update({ status: "failed", error: msg, logs, locked_at: null }).eq("id", job.id);
      if (job.video_id) await db.from("videos").update({ status: "failed" }).eq("id", job.video_id);
    }
  }
}

async function main() {
  console.log(`EarnYoutube worker ${WORKER_ID} — tahap: ${STAGES?.join(", ") ?? "semua"}`);
  while (!stopping) {
    let job: Job | null = null;
    try {
      job = await claim();
    } catch (e) {
      console.error((e as Error).message);
    }
    if (job) {
      await processJob(job);
      continue;
    }
    if (ONCE) break;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  console.log("Worker berhenti.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
