import { writeFile } from "node:fs/promises";
import { adminClient } from "./supabase/admin";

export type Bucket = "renders" | "thumbnails" | "voices" | "assets";

/** Path standar: <channel_id>/<video_id>/<file>. Bucket privat. */
export function objectPath(channelId: string, videoId: string, file: string) {
  return `${channelId}/${videoId}/${file}`;
}

export async function putObject(bucket: Bucket, path: string, data: Buffer, contentType: string) {
  const { error } = await adminClient()
    .storage.from(bucket)
    .upload(path, data, { contentType, upsert: true });
  if (error) throw new Error(`Storage ${bucket}/${path}: ${error.message}`);
  return `${bucket}/${path}`;
}

/** ref = "<bucket>/<path>" */
export function splitRef(ref: string): { bucket: Bucket; path: string } {
  const i = ref.indexOf("/");
  return { bucket: ref.slice(0, i) as Bucket, path: ref.slice(i + 1) };
}

export async function getObject(ref: string): Promise<Buffer> {
  const { bucket, path } = splitRef(ref);
  const { data, error } = await adminClient().storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Gagal mengunduh ${ref}: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function downloadTo(ref: string, file: string) {
  await writeFile(file, await getObject(ref));
  return file;
}

/** URL bertanda tangan untuk preview di browser (berlaku 1 jam). */
export async function signedUrl(ref: string | null | undefined, expiresIn = 3600) {
  if (!ref) return null;
  const { bucket, path } = splitRef(ref);
  const { data } = await adminClient().storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
