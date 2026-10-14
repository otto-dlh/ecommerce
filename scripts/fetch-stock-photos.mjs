// Descarga las fotos de producto de Unsplash (Unsplash License: uso libre, sin marca de agua) a public/products/
// y genera public/products/credits.json con la atribucion de cada fotografo.
//
// Uso: node scripts/fetch-stock-photos.mjs [id-producto ...]
//
// Se usa el enlace oficial de descarga de cada foto (cuenta la descarga para el fotografo, como pide Unsplash).
// Las fotos se autoalojan: el sitio no carga nada de terceros y la CSP sigue en img-src 'self'.
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const outDir = join(root, "public", "products");
const { photos } = JSON.parse(await readFile(join(import.meta.dirname, "photo-sources.json"), "utf8"));
const creditsPath = join(outDir, "credits.json");
const credits = JSON.parse(await readFile(creditsPath, "utf8").catch(() => "{}"));

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(photos);
const MAX_BYTES = 3 * 1024 * 1024;
const isJpeg = (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
// "sergey-kotenev-UK6tuYeWq-E-unsplash.jpg" -> "Sergey Kotenev"
const nameFromDl = (dl, photoId) =>
  dl.replace(/-unsplash\.jpg$/, "").replace(`-${photoId}`, "").split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

await mkdir(outDir, { recursive: true });
let failures = 0;

for (const pid of ids) {
  const photoId = photos[pid];
  if (!photoId) {
    console.error(`✗ ${pid}: sin foto asignada en photo-sources.json`);
    failures++;
    continue;
  }
  try {
    const res = await fetch(`https://unsplash.com/photos/${encodeURIComponent(photoId)}/download?force=true`, { redirect: "manual" });
    const location = res.headers.get("location") || "";
    const url = new URL(location);
    // Solo fotos gratuitas: las de Unsplash+ (pago) se sirven desde plus.unsplash.com
    if (url.hostname !== "images.unsplash.com") throw new Error(`origen no permitido: ${url.hostname}`);
    const photographer = nameFromDl(url.searchParams.get("dl") || "", photoId);
    const img = await fetch(`${url.origin}${url.pathname}?w=900&h=900&fit=crop&crop=entropy&q=80&fm=jpg`, { signal: AbortSignal.timeout(60_000) });
    if (!img.ok) throw new Error(`HTTP ${img.status}`);
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length > MAX_BYTES || !isJpeg(buf)) throw new Error("la respuesta no es un JPEG valido");
    const tmp = join(outDir, `.${pid}.tmp`);
    await writeFile(tmp, buf);
    await rename(tmp, join(outDir, `${pid}.jpg`));
    credits[pid] = { photographer, source: "Unsplash", url: `https://unsplash.com/photos/${photoId}`, license: "Unsplash License" };
    console.log(`✓ ${pid} (${Math.round(buf.length / 1024)} KB) — ${photographer}`);
  } catch (err) {
    console.error(`✗ ${pid}: ${err.message}`);
    failures++;
  }
}

await writeFile(creditsPath, JSON.stringify(credits, null, 2) + "\n");
process.exit(failures ? 1 : 0);
