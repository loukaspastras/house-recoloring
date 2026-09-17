# Spec 06 — Documentation & Git Deployment

## Goal

Ship a professional, accurate README + SUMMARY and push everything to
`origin/main`.

## README.md contents

- Hero + one-paragraph pitch.
- Architecture summary + ASCII workflow diagram (two-stage hybrid).
- Features list.
- Local setup: `npm install`, `npm run dev`, env var setup
  (`GEMINI_API_KEY`), `npm run build`/`start`.
- API reference for `POST /api/segment` (request/response/headers/errors).
- Export mechanics (HSL L preservation, `toBlob`, filename convention).
- Testing instructions (unit + Playwright).
- Tech stack + project layout.

## SUMMARY.md contents

- Final as-built architecture.
- Implemented features (segmentation, real-time compositing, brush, export).
- Test results table (unit + E2E) and build/lint status.
- Export capabilities (format, resolution, naming).
- Step-by-step run instructions.

## Deployment

- Final Conventional Commits.
- `git push -u origin main`.
- Verify remote reflects the tree.

## Verify

```bash
git status && git log --oneline -20 && git push -u origin main
```
