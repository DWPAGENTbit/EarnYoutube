import { getSecret } from "../secrets";

export interface StockItem {
  kind: "video" | "image";
  url: string; // URL unduhan file
  pageUrl: string;
  author: string;
  provider: "pexels" | "pixabay";
  externalId: string;
  license_source: string;
}

type Orientation = "landscape" | "portrait";

/**
 * Cari footage stok berlisensi bebas royalti. Urutan: video Pexels → video
 * Pixabay → foto Pexels → foto Pixabay. `exclude` mencegah klip yang sama
 * dipakai berulang dalam satu video.
 */
export async function findStock(
  userId: string,
  query: string,
  orientation: Orientation,
  exclude: Set<string>,
  preferred: "pexels" | "pixabay" = "pexels",
): Promise<StockItem | null> {
  const pexelsKey = await getSecret(userId, "PEXELS_API_KEY");
  const pixabayKey = await getSecret(userId, "PIXABAY_API_KEY");
  const order: Array<() => Promise<StockItem[]>> = [];
  const pv = () => (pexelsKey ? pexelsVideos(pexelsKey, query, orientation) : Promise.resolve([]));
  const xv = () => (pixabayKey ? pixabayVideos(pixabayKey, query) : Promise.resolve([]));
  const pp = () => (pexelsKey ? pexelsPhotos(pexelsKey, query, orientation) : Promise.resolve([]));
  const xp = () => (pixabayKey ? pixabayPhotos(pixabayKey, query, orientation) : Promise.resolve([]));
  if (preferred === "pixabay") order.push(xv, pv, xp, pp);
  else order.push(pv, xv, pp, xp);
  for (const f of order) {
    try {
      const items = (await f()).filter((i) => !exclude.has(`${i.provider}:${i.externalId}`));
      if (items.length) return items[0];
    } catch {
      /* lanjut ke penyedia berikutnya */
    }
  }
  return null;
}

async function pexelsVideos(key: string, q: string, orientation: Orientation): Promise<StockItem[]> {
  const res = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=${orientation}&per_page=15&size=medium`,
    { headers: { Authorization: key } },
  );
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  const j = await res.json();
  const targetW = orientation === "landscape" ? 1920 : 1080;
  return (j.videos ?? [])
    .filter((v: { duration: number }) => v.duration >= 4)
    .map((v: { id: number; url: string; user: { name: string }; video_files: { link: string; width: number; file_type: string }[] }) => {
      const files = v.video_files
        .filter((f) => f.file_type === "video/mp4" && f.width)
        .sort((a, b) => Math.abs(a.width - targetW) - Math.abs(b.width - targetW));
      if (!files[0]) return null;
      return {
        kind: "video" as const,
        url: files[0].link,
        pageUrl: v.url,
        author: v.user?.name ?? "Pexels",
        provider: "pexels" as const,
        externalId: String(v.id),
        license_source: `Pexels License — ${v.url} (oleh ${v.user?.name ?? "kontributor Pexels"})`,
      };
    })
    .filter(Boolean) as StockItem[];
}

async function pexelsPhotos(key: string, q: string, orientation: Orientation): Promise<StockItem[]> {
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=${orientation}&per_page=15`,
    { headers: { Authorization: key } },
  );
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  const j = await res.json();
  return (j.photos ?? []).map((p: { id: number; url: string; photographer: string; src: { large2x: string } }) => ({
    kind: "image" as const,
    url: p.src.large2x,
    pageUrl: p.url,
    author: p.photographer,
    provider: "pexels" as const,
    externalId: `p${p.id}`,
    license_source: `Pexels License — ${p.url} (foto oleh ${p.photographer})`,
  }));
}

async function pixabayVideos(key: string, q: string): Promise<StockItem[]> {
  const res = await fetch(`https://pixabay.com/api/videos/?key=${key}&q=${encodeURIComponent(q)}&per_page=15&safesearch=true`);
  if (!res.ok) throw new Error(`Pixabay ${res.status}`);
  const j = await res.json();
  return (j.hits ?? [])
    .filter((h: { duration: number }) => h.duration >= 4)
    .map((h: { id: number; pageURL: string; user: string; videos: { large?: { url: string }; medium: { url: string } } }) => ({
      kind: "video" as const,
      url: h.videos.large?.url || h.videos.medium.url,
      pageUrl: h.pageURL,
      author: h.user,
      provider: "pixabay" as const,
      externalId: String(h.id),
      license_source: `Pixabay Content License — ${h.pageURL} (oleh ${h.user})`,
    }))
    .filter((i: StockItem) => i.url);
}

async function pixabayPhotos(key: string, q: string, orientation: Orientation): Promise<StockItem[]> {
  const o = orientation === "landscape" ? "horizontal" : "vertical";
  const res = await fetch(
    `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(q)}&orientation=${o}&image_type=photo&per_page=15&safesearch=true`,
  );
  if (!res.ok) throw new Error(`Pixabay ${res.status}`);
  const j = await res.json();
  return (j.hits ?? []).map((h: { id: number; pageURL: string; user: string; largeImageURL: string }) => ({
    kind: "image" as const,
    url: h.largeImageURL,
    pageUrl: h.pageURL,
    author: h.user,
    provider: "pixabay" as const,
    externalId: `p${h.id}`,
    license_source: `Pixabay Content License — ${h.pageURL} (foto oleh ${h.user})`,
  }));
}

export async function downloadFile(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Unduh stok gagal ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
