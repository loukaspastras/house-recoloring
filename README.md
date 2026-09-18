# House Recoloring — AI Wall Painter

Upload a photo of a house and recolor its walls in **real time in the browser**
(60 FPS, zero API calls per color swap) while preserving the original shadows,
highlights, and wall textures.

A single Gemini image-edit call identifies the paintable walls once; everything
after that — color picking, preset swaps, opacity, brush touch-ups, and
full-resolution export — runs entirely client-side on the HTML5 Canvas.

## How it works (two-stage hybrid)

```
Browser (React)                        Server (Next.js route handler)
┌──────────────────────────────┐      ┌───────────────────────────────────────┐
│ UploadZone ──POST──────────▶ │      │ POST /api/segment                      │
│                              │      │  ├─ validate (JPEG/PNG, ≤15 MB)        │
│ ◀─────────── wall-mask.png ──┼──────┤  ├─ image-edit: paint walls green      │
│                              │      │  ├─ green-pixel → binary mask (full-res)│
│ WallPainter engine           │      │  └─ fallback: polygon → mock           │
│  ├─ base layer (ImageData)   │      └───────────────────────────────────────┘
│  ├─ lightness map (Uint16)   │
│  ├─ AI mask + brush mask     │
│  ├─ 511-entry HSL LUT        │
│  └─ composite canvas         │
│ ColorPicker / Brush / Export │
└──────────────────────────────┘
```

**Stage 1 — Segmentation (server):** the endpoint asks a Gemini image-editing
model (`gemini-3.1-flash-image`) to **repaint the walls light green** and
touches nothing else, then turns that into a binary mask (white = wall) by
flagging green-dominant pixels at the image's **full native resolution**. If
the edit call fails, it falls back to the older polygon-JSON method, then to a
deterministic mock.

**Stage 2 — Recoloring (browser):** on load, the engine precomputes each
pixel's exact HSL lightness once (`max+min` of RGB, a `Uint16` map). Changing a
color only builds a **511-entry lookup table** mapping lightness → the target
color's RGB, then does a single packed-32-bit pass over the wall pixels. Hue
and saturation are swapped, **lightness is preserved exactly** (the recolor is
applied to the *original* image, not the green edit), and the swap completes in
**under 16 ms on a 1080p image** — no per-pixel trigonometry, no network, no
LLM calls.

## Features

- 🖼️ Drag-and-drop upload (JPEG/PNG, ≤15 MB) with client-side validation
- 🧠 One-shot AI wall segmentation via Gemini image editing (`gemini-3.1-flash-image`)
- 🎨 Real-time HSL recoloring that preserves shadows, highlights, and texture
- 🎛️ `react-colorful` wheel, hex input, and 8 architectural paint presets
- 🖌️ Manual mask touch-up brush (add/erase) with size & edge-softness controls
- 👁️ Mask-overlay toggle to see exactly what's selected
- 💪 Color-strength (opacity) slider for subtle tints
- ⬇️ One-click **Download Image** — non-blocking `canvas.toBlob()` export at
  full native resolution, named after the color (`recolored-house-#2a4d69.png`)

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure the Gemini API key

```bash
cp .env.example .env.local
# then edit .env.local and paste your key:
#   GEMINI_API_KEY=your_key_here
```

Get a key at <https://aistudio.google.com/apikey>. The app degrades gracefully
without a key: `/api/segment` returns a deterministic **mock mask** so the full
UI remains usable.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | no* | — | Gemini API key |
| `GEMINI_EDIT_MODEL` | no | `gemini-3.1-flash-image` | Image-editing model (primary segmentation) |
| `GEMINI_MODEL` | no | `gemini-3.6-flash` | Vision model (polygon fallback) |
| `GEMINI_SEGMENT_MODE` | no | `auto` | `auto` (edit→polygon) · `edit` · `polygon` |

\* optional; a mock fallback is used when absent.

### 3. Run

```bash
npm run dev        # http://localhost:3000
```

Production:

```bash
npm run build
npm run start
```

## API reference

### `POST /api/segment`

Accepts a `multipart/form-data` upload with an `image` file (JPEG or PNG,
≤ 15 MB) and returns a **binary mask PNG** where white = paintable walls.

```
POST /api/segment
Content-Type: multipart/form-data
body: image=<file>
```

**Response (200)**

```
Content-Type: image/png
X-Mask-Source: gemini-edit | gemini | mock | empty
X-Mask-Width:  800
X-Mask-Height: 600
```

| Status | Meaning |
| --- | --- |
| `200` | Mask produced (`X-Mask-Source` indicates provenance) |
| `400` | Missing/empty/unsupported image or bad content type |
| `413` | Image exceeds 15 MB |
| `500` | Unexpected server error |

## How export works

The **Download Image** button calls `HTMLCanvasElement.toBlob()` (async, off the
main thread) and `URL.createObjectURL()` to trigger the browser download, so
high-resolution photos never freeze the UI:

```ts
const exportImage = (canvas, colorHex) => {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `recolored-house-${colorHex.replace("#", "")}.png`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png", 1.0);
};
```

The exported image is the **full native resolution** composite — no scaling
artifacts.

## Testing

```bash
npm test           # Jest unit tests (53 tests)
npm run test:e2e   # Playwright end-to-end (requires a prior `npm run build`)
npm run typecheck  # TypeScript
npm run lint       # ESLint
```

The unit suite covers the rasterizer (even-odd fill), green-mask extraction,
the HSL/color math, the pixel engine (including a **sub-16 ms 1080p swap
benchmark** and exact lightness-preservation checks), the export helpers, and
the API route's validation/fallback behavior.

The Playwright suite uploads `public/sample-house.png`, asserts the segment
response, changes colors (verifying **zero further network calls**), toggles the
mask, and verifies the download filename — all with a **clean console**.

## Tech stack & layout

- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **AI:** `@google/genai` (Gemini image editing + vision), `sharp` (server image I/O)
- **UI:** `react-colorful`, `lucide-react`, `clsx`
- **Tests:** Jest + Testing Library, Playwright

```
src/
├─ app/
│  ├─ api/segment/route.ts   # segmentation endpoint
│  ├─ layout.tsx / page.tsx
├─ components/               # UploadZone, CanvasWorkspace, ControlsSidebar, …
├─ hooks/useWallPainter.ts   # dual-canvas compositing hook
├─ lib/
│  ├─ geminiEdit.ts          # image-edit call (walls → green)
│  ├─ greenMask.ts           # green-pixel → binary mask
│  ├─ editSegment.ts         # edit → upscale → green mask
│  ├─ gemini.ts              # polygon fallback (vision + JSON schema)
│  ├─ rasterize.ts           # even-odd polygon → binary mask
│  ├─ segment.ts             # server pipeline + fallback ladder
│  ├─ maskPng.ts / imageMeta.ts
│  ├─ paint/                 # colorMath, paintEngine, exportImage
│  └─ palette.ts             # paint presets
e2e/                         # Playwright specs
specs/                       # engineering phase specs
```

## Live demo

1. `npm run dev` (or `npm run build && npm start`).
2. Open the app and drag in a house photo — or use `public/sample-house.png`.
3. Pick a preset or use the color wheel; brush to refine; hit **Download Image**.
