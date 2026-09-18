# House Recoloring — Engineering Specs

This directory contains the granular, phase-by-phase specifications that drive
the delivery of the **House Wall Recoloring Web Application**. Each spec is a
self-contained, reviewable unit of work with explicit acceptance criteria so it
can be implemented, verified, and committed independently (agile chunks).

## How specs map to delivery

| Spec | Scope | Status |
| --- | --- | --- |
| [01-scaffolding](./01-scaffolding.md) | Repo, Next.js + tooling bootstrapping | ✅ done |
| [02-segmentation-api](./02-segmentation-api.md) | `/api/segment` + Gemini vision + mask rasterizer | ✅ done |
| [03-compositing-engine](./03-compositing-engine.md) | Real-time HSL recoloring + export engine | ✅ done |
| [04-frontend-ui](./04-frontend-ui.md) | Upload, canvas workspace, controls, download | ✅ done |
| [05-e2e-verification](./05-e2e-verification.md) | Playwright E2E + clean build | ✅ done |
| [06-docs-deploy](./06-docs-deploy.md) | README, SUMMARY, git push | ✅ done |
| [07-image-edit-mask](./07-image-edit-mask.md) | Green-paint image-edit segmentation (primary) | ✅ done |

## Conventions

- **Commit style**: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`,
  `chore:`, `refactor:`).
- **Definition of done**: feature implemented + unit/E2E tests green + `npm run
  build` clean + `npm run lint` clean + no `TODO`/placeholder code.
- **Verification gate**: every spec closes with a "verify" step listing the
  exact commands that must pass before the phase is committed.

## Architecture at a glance

```
Browser (React)                     Server (Next.js route handler)
┌─────────────────────────────┐     ┌──────────────────────────────────────┐
│ UploadZone → /api/segment   │ ───▶│ POST /api/segment                    │
│   │                         │     │  ├─ validate image (JPEG/PNG, ≤15MB) │
│   ▼                         │     │  ├─ Gemini Vision → wall polygons    │
│ WallPainter engine          │     │  ├─ rasterize → binary mask PNG      │
│  ├─ base layer (ImageData)  │ ◀───│  └─ fallback mock when key absent    │
│  ├─ lightness map (Uint16)  │     └──────────────────────────────────────┘
│  ├─ AI mask + brush mask    │
│  ├─ HSL LUT (511 entries)   │
│  └─ composite canvas        │
│ ColorPicker / Brush / Export│
└─────────────────────────────┘
```

See [SUMMARY.md](../SUMMARY.md) for the final as-built description.
