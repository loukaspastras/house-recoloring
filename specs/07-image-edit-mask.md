# Spec 07 — Image-Edit Mask Segmentation (v2)

> **Status:** ✅ done — implemented and verified. Supersedes the polygon method
> in [02-segmentation-api](./02-segmentation-api.md) as the **primary** path.

## Goal

Replace the polygon-JSON method (which produced imprecise masks) with an
image-editing approach: ask Gemini to **paint the walls green**, then extract a
mask from the green pixels.

## Final method (as built)

```
POST /api/segment
  ├─ validate image (JPEG/PNG, ≤15MB)
  ├─ [primary] image-edit model: "make every wall ... light green (#00b140)"
  │     model: gemini-3.1-flash-image (the web-UI-grade editor)
  ├─ upscale the edited image to the ORIGINAL native resolution
  ├─ flag green-dominant pixels (g − max(r,b) ≥ 15) → binary mask
  └─ fallback ladder: polygon JSON → deterministic mock
```

The mask is applied by the client to the **original** full-res image, so
lightness/shadows and native export resolution are preserved.

## Key findings from the PoC (why it looks like this)

1. **`gemini-2.5-flash-image` is broken for this task** — it ignores the
   "paint walls green" instruction (produces near-neutral output or a global
   duotone). `gemini-3.1-flash-image` (and `nano-banana-pro` /
   `gemini-3-pro-image`) reliably paint **only** the walls, with `gemini-3.1`
   being the cleanest (no over-paint of cabinets/ceiling).
2. **Pixel-diff is a dead end** — the model injects a global tone/white-balance
   shift + JPEG noise; since walls are ~40–50% of the frame, the shift can't be
   cleanly separated from the wall change. Green detection (no comparison to the
   original) is robust to that shift.
3. **The walls must be painted a *saturated* green.** "Light sage" (the user's
   first image) is too desaturated → detection misses highlight areas. The
   prompt's `#00b140` wording yields a saturated, uniform green.
4. **Resizing raw 1-channel buffers with `sharp` corrupts the data** (scanline
   banding). Workaround: upscale the edited *RGBA image* first, then compute the
   green mask at full resolution.
5. **Alignment is never a problem** — the edit preserves framing (uniform scale),
   so the mask aligns with the original after upscaling.

## Design decisions

| Decision | Choice |
| --- | --- |
| Wall color | light green `#00b140` (saturated, absent from most scenes) |
| Mask signal | green-dominant pixels only (no diff) |
| Green test | `g − max(r,b) ≥ 15` and lightness ≥ 0.05 |
| Resolution | detect at full native res (upscale edited image first) |
| Compositing base | the ORIGINAL image (lightness preserved) |
| Model | `gemini-3.1-flash-image` (configurable via `GEMINI_EDIT_MODEL`) |
| Fallback | polygon JSON → mock |

## Files

- `src/lib/greenMask.ts` — `computeGreenMask` (pure, tested).
- `src/lib/geminiEdit.ts` — image-edit call (returns edited bytes).
- `src/lib/editSegment.ts` — edit → upscale → green mask.
- `src/lib/segment.ts` — fallback ladder (edit → polygon → mock).
- `src/lib/types.ts` — `MaskSource` gains `"gemini-edit"`.
- `src/lib/__tests__/greenMask.test.ts` — green test coverage.

## Acceptance criteria (all met)

- `/api/segment` returns `X-Mask-Source: gemini-edit` when the edit succeeds.
- Mask visually isolates walls (verified on a real kitchen photo: ~48%
  coverage, minimal bleed, shadows preserved after recolor).
- Fallback ladder works (E2E exercises the mock path with no key).
- `npm test` (53), `npm run lint`, `npm run typecheck`, `npm run build`, and
  Playwright E2E all pass.

## Verify

```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run test:e2e
```
