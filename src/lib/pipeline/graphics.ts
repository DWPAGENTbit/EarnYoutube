import sharp from "sharp";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Bungkus teks per jumlah karakter maksimum per baris. */
export function wrap(text: string, maxChars: number, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, "") + "…";
    return kept;
  }
  return lines;
}

const FONT = "Arial, 'Helvetica Neue', 'DejaVu Sans', sans-serif";

/** Subtitle: PNG transparen seukuran frame, teks di sepertiga bawah. */
export async function captionPng(text: string, w: number, h: number): Promise<Buffer> {
  const vertical = h > w;
  const size = vertical ? 64 : 52;
  const lines = wrap(text, vertical ? 22 : 40, 2);
  const lineH = size * 1.25;
  const baseY = vertical ? h * 0.72 : h - 90 - (lines.length - 1) * lineH;
  const tspans = lines
    .map((l, i) => `<tspan x="${w / 2}" y="${baseY + i * lineH}">${esc(l)}</tspan>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <text text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="800"
    fill="#ffffff" stroke="#000000" stroke-width="${size / 7}" paint-order="stroke" stroke-linejoin="round">${tspans}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Teks di layar (on_screen_text) — label di kiri atas. */
export async function headlinePng(text: string, w: number, h: number): Promise<Buffer> {
  const vertical = h > w;
  const size = vertical ? 56 : 44;
  const lines = wrap(text, vertical ? 20 : 34, 2);
  const lineH = size * 1.2;
  const padX = 28;
  const boxW = Math.min(w - 80, Math.max(...lines.map((l) => l.length)) * size * 0.58 + padX * 2);
  const boxH = lines.length * lineH + 32;
  const x0 = vertical ? (w - boxW) / 2 : 60;
  const y0 = vertical ? 180 : 60;
  const tspans = lines
    .map((l, i) => `<tspan x="${x0 + padX}" y="${y0 + 16 + size + i * lineH - size * 0.15}">${esc(l)}</tspan>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect x="${x0}" y="${y0}" width="${boxW}" height="${boxH}" rx="14" fill="#0B1220" fill-opacity="0.78"/>
  <rect x="${x0}" y="${y0}" width="8" height="${boxH}" rx="4" fill="#22C4E0"/>
  <text font-family="${FONT}" font-size="${size}" font-weight="800" fill="#ffffff">${tspans}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Latar gradien (dipakai bila tidak ada stok yang cocok — aset buatan sendiri). */
export async function gradientPng(w: number, h: number, seed = 0): Promise<Buffer> {
  const palettes = [
    ["#0B3D91", "#22C4E0"],
    ["#1E1B4B", "#1E6FE0"],
    ["#0F172A", "#0EA5E9"],
  ];
  const [a, b] = palettes[seed % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Thumbnail 1280×720: latar dari frame video/gambar scene, gradien gelap,
 * teks besar (maks 4 kata) dengan aksen warna.
 */
export async function thumbnailPng(bg: Buffer | null, text: string, variant = 0): Promise<Buffer> {
  const W = 1280;
  const H = 720;
  const base = bg
    ? await sharp(bg).resize(W, H, { fit: "cover" }).modulate({ saturation: 1.25, brightness: 1.05 }).toBuffer()
    : await gradientPng(W, H, variant);
  const accents = ["#FFD60A", "#22C4E0", "#FF4D6D"];
  const accent = accents[variant % accents.length];
  const words = text.toUpperCase().split(/\s+/).slice(0, 4);
  const lines = wrap(words.join(" "), 11, 3);
  const size = lines.length > 2 ? 104 : 128;
  const lineH = size * 1.02;
  const startY = H / 2 - ((lines.length - 1) * lineH) / 2 + size * 0.35;
  const tspans = lines
    .map(
      (l, i) =>
        `<tspan x="70" y="${startY + i * lineH}" fill="${i === lines.length - 1 ? accent : "#FFFFFF"}">${esc(l)}</tspan>`,
    )
    .join("");
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0.85"/><stop offset="0.65" stop-color="#000" stop-opacity="0.25"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#s)"/>
  <text font-family="${FONT}" font-size="${size}" font-weight="900" stroke="#000" stroke-width="10" paint-order="stroke" stroke-linejoin="round">${tspans}</text>
</svg>`;
  return sharp(base)
    .composite([{ input: Buffer.from(overlay) }])
    .png()
    .toBuffer();
}
