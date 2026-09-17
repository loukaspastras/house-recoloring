# Spec 02 — Backend Gemini Vision Segmentation (`/api/segment`)

## Goal

A `POST /api/segment` route that accepts a house photo and returns a
high-resolution **binary mask PNG** (white = paintable walls/siding, black =
everything else), using **one** Gemini Vision call. Falls back to a
deterministic mock when the API key is absent or the call fails.

## Design

Instead of asking Gemini for a raster mask directly (unreliable), the model is
asked to return **normalized polygon coordinates** of paintable wall regions as
structured JSON. The server rasterizes those polygons into a binary mask with a
pure-JS even-odd scanline fill, then PNG-encodes it with `sharp`.

### Files

- `src/lib/types.ts` — shared types (`WallRegion`, `SegmentPolygon`,
  `SegmentResult`).
- `src/lib/gemini.ts` — `GoogleGenAI` client; `generateContent` with
  `responseMimeType: "application/json"` + `responseJsonSchema`; robust JSON
  parsing (direct + fenced/embedded fallback).
- `src/lib/rasterize.ts` — even-odd polygon fill producing a `Uint8Array`
  (0/255) at the source dimensions.
- `src/lib/maskPng.ts` — encode mask → PNG buffer (and decode PNG → mask for
  tests) via `sharp`.
- `src/lib/imageMeta.ts` — decode source image metadata and, when needed,
  downscale a copy for the Gemini call (polygons stay normalized so the mask
  is still rasterized at full native resolution).
- `src/lib/mock.ts` — deterministic mock: a plausible wall polygon set so the
  app is fully functional without a key.
- `src/lib/segment.ts` — orchestrator: read image dims (from PNG/JPEG header),
  call Gemini, rasterize, encode; catch errors → mock fallback with a
  `source: "mock"` marker.
- `src/app/api/segment/route.ts` — route handler: validate content-type +
  size, return `image/png` mask with metadata headers (`X-Mask-Source`,
  `X-Mask-Width`, `X-Mask-Height`).

### Prompt requirements

- Ask only for paintable exterior walls/siding (not windows, doors, trim,
  roof, vegetation, sky).
- Require polygons in `[[x,y],...]` normalized 0–1 coordinates, ordered lists.
- Set `temperature: 0` for determinism.

### Error handling

| Case | HTTP | Body |
| --- | --- | --- |
| Missing/invalid image | 400 | `{ error }` |
| Unsupported type / oversize | 400 / 413 | `{ error }` |
| Gemini missing key / API failure | 200 | mock mask + `X-Mask-Source: mock` |
| No walls detected | 200 | empty mask + `X-Mask-Source: empty` |

## Tests

- `src/lib/__tests__/rasterize.test.ts` — even-odd fill, edge coordinates.
- `src/lib/__tests__/maskPng.test.ts` — encode/decode round-trip (node env).
- `src/lib/__tests__/mock.test.ts` — deterministic output shape.
- `src/app/api/segment/__tests__/route.test.ts` — 400/413 validation, mock
  fallback response, PNG content-type.

## Verify

```bash
npm test && npm run typecheck && npm run build
```
