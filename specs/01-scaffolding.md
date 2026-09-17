# Spec 01 — Repository & Environment Initialization

## Goal

Stand up a fresh Next.js (App Router) + TypeScript + Tailwind project in
`git@github.com:loukaspastras/house-recoloring.git` with all runtime and
tooling dependencies, ready for feature work.

## Tasks

1. Verify SSH access and that the remote exists (may be empty). Add
   `origin` = `git@github.com:loukaspastras/house-recoloring.git`.
2. Scaffold Next.js with `--typescript --tailwind --eslint --app --src-dir`.
3. Install runtime deps:
   - `@google/genai` (Gemini vision SDK)
   - `react-colorful` (color wheel picker)
   - `lucide-react` (icons)
   - `clsx` (class composition)
   - `pngjs` (pure-JS PNG encode/decode for the server-side mask)
4. Install dev deps:
   - `jest`, `jest-environment-jsdom`, `@testing-library/react`,
     `@testing-library/jest-dom`, `@types/jest`
   - `@playwright/test`
   - `prettier`, `prettier-plugin-tailwindcss`
5. Add npm scripts: `test`, `test:watch`, `test:e2e`, `typecheck`, `lint`,
   `lint:fix`, `format`, `format:check`.
6. Configure:
   - `next.config.ts` with `serverExternalPackages: ["@google/genai", "pngjs"]`
   - `jest.config.ts` (via `next/jest`) + `jest.setup.ts`
   - `.prettierrc` / `.prettierignore`
   - `.env.example` documenting `GEMINI_API_KEY` + `GEMINI_MODEL`
   - `.gitignore` un-ignores `.env.example` and adds Playwright artifacts
7. Remove the boilerplate homepage content and strip the Google web-font
   dependency (self-contained system font stack) to keep builds network-free.

## Acceptance criteria

- `npm run typecheck`, `npm run lint`, `npm run build` all exit 0.
- `npm test` runs (0 tests is acceptable at this stage).
- `git log` shows a `feat: scaffold nextjs app` commit.

## Verify

```bash
npm run typecheck && npm run lint && npm run build && npm test
```
