// Generates a deterministic, self-contained "house" fixture used by the
// Playwright E2E suite so tests never depend on the network or the Gemini key.
//
// Usage: node scripts/generate-sample.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#cfe0f2"/>
  <rect x="200" y="320" width="400" height="220" fill="#d9c7a7"/>
  <polygon points="160,330 400,180 640,330" fill="#7a4a3a"/>
  <rect x="260" y="380" width="110" height="160" fill="#f5f0e6"/>
  <rect x="430" y="380" width="90" height="90" fill="#8fb7d8"/>
  <rect x="60" y="540" width="680" height="60" fill="#7fbf7f"/>
</svg>`;

const outDir = path.join(root, "public");
await mkdir(outDir, { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, "sample-house.png"));
console.log("wrote public/sample-house.png");
