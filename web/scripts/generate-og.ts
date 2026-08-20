import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderOgSvg } from "@ship72/ui";
import sharp from "sharp";

const outputDirectory = resolve(import.meta.dirname, "..", "public");
const svg = renderOgSvg({
  eyebrow: "Contemporaneous R&D records",
  slug: "rdlog",
  subtitle: "Append-only entries · SHA-256 chain · exact calendar receipts",
  title: "Build the record before memory fills the gaps.",
});

await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, "og.svg"), svg, "utf8");
await sharp(Buffer.from(svg)).png().toFile(resolve(outputDirectory, "og.png"));
