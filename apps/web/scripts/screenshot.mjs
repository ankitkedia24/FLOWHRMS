/**
 * Dev utility: capture review screenshots of the running dev server with a
 * precise CSS viewport (Windows headless Chrome otherwise applies OS DPI
 * scaling to --window-size and crops the layout).
 *
 * Usage: node scripts/screenshot.mjs <outDir> <name:url:width:height> ...
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [outDir, ...specs] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath:
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--force-device-scale-factor=1"],
});

for (const spec of specs) {
  const [name, url, width, height] = spec.split("|");
  const page = await browser.newPage();
  await page.setViewport({
    width: Number(width),
    height: Number(height),
    deviceScaleFactor: 1,
  });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
  await new Promise((resolve) => setTimeout(resolve, 600)); // font settle
  const path = join(outDir, name);
  await page.screenshot({ path });
  console.log(`captured ${name}`);
  await page.close();
}

await browser.close();
