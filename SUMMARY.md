# SUMMARY

**Project:** House Recoloring — AI-powered wall repainting web application
**Repository:** <https://github.com/loukaspastras/house-recoloring>
**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Gemini
image editing · HTML5 Canvas

---

## 1. What it does

Users upload a photo of a house. A **single** Gemini image-edit call repaints
the paintable walls green and returns a full-resolution binary mask. From then
on, recoloring happens **entirely in the browser at 60 FPS** — hue and
saturation are swapped per-pixel while the original **lightness channel is
preserved exactly**, keeping real shadows, highlights, and wall texture intact.
A single **Download Image** button exports the recolored photo at full native
resolution.

## 2. Final architecture

```
┌─────────────────────────────┐        ┌────────────────────────────────────┐
│  BROWSER (React, Canvas)     │  POST  │  SERVER (Next.js route handler)    │
│                             │ ─────▶ │  /api/segment                       │
│  UploadZone → segment()     │        │   ├ validate JPEG/PNG ≤ 15MB        │
│                             │ ◀───── │   ├ image-edit: paint walls green     │
│  useWallPainter engine      │  mask  │   ├ green-pixel → binary mask (full) │
│   • base layer (ImageData)  │  PNG   │   └ fallback: polygon → mock         │
│   • lightness map (Uint16)  │        └────────────────────────────────────┘
│   • AI mask + brush mask    │
│   • 511-entry HSL LUT       │
│   • composite canvas        │
│  ColorPicker / Brush /      │
│  Export (toBlob)            │
└─────────────────────────────┘
```

### Stage 1 — Server segmentation (`src/lib/editSegment.ts`, `src/lib/segment.ts`, `src/app/api/segment/route.ts`)

- **Primary:** a Gemini image-editing model (`gemini-3.1-flash-image`) repaints
  the walls light green; `src/lib/greenMask.ts` flags green-dominant pixels
  (`g − max(r,b) ≥ 15`) into a binary mask at the source image's **native
  resolution** (the edited image is upscaled first).
- **Fallback 1:** the original polygon-JSON method (`gemini-3.6-flash` →
  normalized polygons → even-odd scanline rasterization).
- **Fallback 2:** a deterministic mock mask when the key is missing or both
  methods fail (`X-Mask-Source: mock`).

### Stage 2 — Browser compositing (`src/lib/paint/*`, `src/hooks/useWallPainter.ts`)

- On load, `computeLightness` builds a `Uint16` map of each pixel's exact
  lightness (`max+min`, 0–510).
- On color change, `buildLightnessLut` builds a 511-entry packed-32-bit LUT;
  `applyRecolor` does one pass that **replaces H/S and keeps L** for wall
  pixels, blends brush-edge/opacity pixels, and leaves non-wall pixels
  byte-identical. Hot loop uses packed 32-bit writes.
- Brush strokes update a refinement mask (128 = neutral, add→255, erase→0) and
  recomposite only the dirty bounding box.
- Export uses `canvas.toBlob()` + `URL.createObjectURL()` (non-blocking).

## 3. Implemented features

| Feature | Status |
| --- | --- |
| Drag-and-drop + browse upload (JPEG/PNG, ≤15 MB, validation) | ✅ |
| `POST /api/segment` returning full-res binary wall mask | ✅ |
| Gemini image-edit wall detection (paint-walls-green → mask) | ✅ |
| Polygon-JSON fallback + deterministic mock fallback | ✅ |
| Pure-JS even-odd polygon rasterizer | ✅ |
| Green-pixel mask extraction (pure, tested) | ✅ |
| Real-time HSL recolor preserving lightness (sub-16 ms @1080p) | ✅ |
| `react-colorful` wheel + hex input + 8 paint presets | ✅ |
| Color-strength (opacity) slider | ✅ |
| Mask touch-up brush (add/erase, size, softness, reset) | ✅ |
| Mask-overlay toggle | ✅ |
| Non-blocking full-res PNG export named by color | ✅ |
| Responsive layout (header / hero / workspace / sidebar) | ✅ |

## 4. Test results

| Suite | Result |
| --- | --- |
| Jest unit tests | **53 passed** (8 suites) |
| Playwright E2E (`e2e/flow.spec.ts`) | **1 passed** |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run build` | clean |

Unit coverage includes: even-odd rasterizer, green-mask extraction, PNG
round-trip, Gemini JSON parsing, API route validation/fallback, HSL↔RGB
round-trips, **exact lightness preservation**, brush mask math, export
blob/filename, and a **sub-16 ms 1080p swap benchmark**.

E2E verifies: upload → segment (`image/png`, `X-Mask-Source: mock`) → canvas
ready → preset color changes with **zero extra API calls** → mask toggle →
download with filename `recolored-house-<hex>.png` → **zero console errors**.

## 5. Export capabilities

- **Format:** PNG (`image/png`, quality 1.0).
- **Resolution:** full native source resolution (no scaling).
- **Mechanism:** non-blocking `HTMLCanvasElement.toBlob()` →
  `URL.createObjectURL()` → programmatic `<a download>` click.
- **Naming:** `recolored-house-<hex>.png` (e.g. `recolored-house-2a4d69.png`).

## 6. Running the application

```bash
git clone git@github.com:loukaspastras/house-recoloring.git
cd house-recoloring
npm install
cp .env.example .env.local   # add GEMINI_API_KEY (optional — mock fallback otherwise)
npm run dev                  # http://localhost:3000
```

Production:

```bash
npm run build
npm run start
```

Tests:

```bash
npm test
npm run build && npm run test:e2e
```

## 7. Engineering specs

Granular, phase-by-phase specs live in [`specs/`](./specs/README.md) and were
committed incrementally following Conventional Commits:

```
4c76d9a feat: build responsive recoloring UI and Playwright E2E suite
ddd321c feat: implement real-time HSL compositing and export engine
a386b08 feat: implement Gemini vision wall segmentation API
fa43eef feat: scaffold nextjs app with typescript, tailwind, and tooling
```
