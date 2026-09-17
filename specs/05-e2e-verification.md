# Spec 05 — End-to-End Verification & Testing

## Goal

Prove the full user journey works in a real browser and the app builds cleanly.

## Playwright setup

- `playwright.config.ts` (Chromium project, `webServer` booting `next dev` or
  `next start` after build).
- A generated `public/sample-house.png` fixture (deterministic house-like
  image) so tests never depend on the network or the Gemini key.

## E2E scenarios (`e2e/flow.spec.ts`)

1. **Upload → segment → canvas**: drop the sample image, expect the workspace
   canvas to appear and the `POST /api/segment` response to have
   `Content-Type: image/png` (mock fallback path).
2. **Color change**: pick/preset a color, assert the canvas re-renders (no
   network calls emitted after init).
3. **Download**: click **Download Image**, intercept the download event, assert
   the suggested filename matches `recolored-house-<hex>.png` and a non-empty
   payload is produced.
4. **Console cleanliness**: collect `console` errors across the run → expect 0.

## CI-style gate

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Verify

All gates green; `npx playwright test` passes against the built app.
