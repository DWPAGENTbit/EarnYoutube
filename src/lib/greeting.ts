/** Nama tampilan dari email: "dhany.wp@x.com" → "Dhany Wp". */
export function displayName(email: string | null | undefined) {
  const local = (email ?? "").split("@")[0] || "Kreator";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .slice(0, 28);
}

/** Sapaan sesuai jam di WIB. */
export function greeting(date = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(date));
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}
