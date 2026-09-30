import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const favicon = await readFile(
  new URL("../public/favicon.svg", import.meta.url),
);
await Promise.all(
  [
    [192, "icon-192.png"],
    [512, "icon-512.png"],
    [180, "apple-touch-icon.png"],
  ].map(async ([size, name]) => {
    await sharp(favicon)
      .resize(size, size)
      .png()
      .toFile(fileURLToPath(new URL(`../public/${name}`, import.meta.url)));
  }),
);
const mask =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#235beb"/><g fill="none" stroke="white" stroke-linecap="round" stroke-width="32"><path d="M145 205v102M200 170v172M312 170v172M367 205v102M200 256h112"/></g></svg>';
await writeFile(
  new URL("../public/icon-maskable.png", import.meta.url),
  await sharp(Buffer.from(mask)).png().toBuffer(),
);
console.log("Created four PWA icons.");
