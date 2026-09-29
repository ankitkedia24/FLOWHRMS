# FlowHRMS Monorepo Migration Task Plan

## Legend
- `[ ]` Not started
- `[/]` In progress
- `[x]` Completed

---

## Phase 1: Directory Scaffolding & Git Staging Safety
- [x] **Task 1.1**: Ensure local git working tree is clean and create a safety commit or branch if needed.
- [x] **Task 1.2**: Create `apps/` and `packages/` root directories.
- [x] **Task 1.3**: Create target directories:
  - `apps/web`
  - `apps/mobile`
  - `packages/types/src`
  - `packages/validation/src`

---

## Phase 2: Web App Migration (`apps/web`)
- [x] **Task 2.1**: Move Next.js application directories into `apps/web/`:
  - `src/` -> `apps/web/src/`
  - `public/` -> `apps/web/public/`
  - `scripts/` -> `apps/web/scripts/`
  - `design/` -> `apps/web/design/`
- [x] **Task 2.2**: Move Next.js configuration files into `apps/web/`:
  - `next.config.ts`
  - `postcss.config.mjs`
  - `eslint.config.mjs`
  - `vitest.config.mts`
  - `tsconfig.json`
- [x] **Task 2.3**: Create `apps/web/package.json` naming it `"@flowhrms/web"`, retaining all web dependencies (`next`, `react`, `@supabase/ssr`, `@prisma/client`, etc.).
- [x] **Task 2.4**: Update `apps/web/next.config.ts` to include `transpilePackages: ["@flowhrms/types", "@flowhrms/validation"]`.

---

## Phase 3: Mobile App Migration (`apps/mobile`)
- [x] **Task 3.1**: Move existing `mobile/` directory into `apps/mobile/`.
- [x] **Task 3.2**: Update `apps/mobile/package.json` to name the package `"@flowhrms/mobile"`.
- [x] **Task 3.3**: Create `apps/mobile/metro.config.js` with monorepo `watchFolders` and dual `nodeModulesPaths`.
- [x] **Task 3.4**: Verify `apps/mobile/app.json` and `apps/mobile/eas.json` paths remain intact.

---

## Phase 4: Shared Packages Scaffolding (`packages/`)
- [x] **Task 4.1**: Initialize `packages/types/`:
  - Create `package.json` (`@flowhrms/types`)
  - Create `tsconfig.json`
  - Create `src/index.ts` exporting domain interfaces (Attendance, Leave, Session)
- [x] **Task 4.2**: Initialize `packages/validation/`:
  - Create `package.json` (`@flowhrms/validation`) with dependency on `zod`
  - Create `tsconfig.json`
  - Create `src/index.ts` exporting shared Zod schemas (punch-in coords, auth, leave forms)
- [x] **Task 4.3**: Add `@flowhrms/types` and `@flowhrms/validation` to `dependencies` of `apps/web` and `apps/mobile`.

---

## Phase 5: Root Orchestration & Tooling
- [x] **Task 5.1**: Update root `package.json` with `"workspaces": ["apps/*", "packages/*"]` and top-level scripts:
  - `"dev:web"`
  - `"dev:mobile"`
  - `"build:web"`
  - `"db:generate"`
- [x] **Task 5.2**: Update root `.gitignore` to support monorepo outputs (`apps/web/.next`, `apps/mobile/.expo`, `dist/`).
- [x] **Task 5.3**: Run `npm install` at monorepo root to link workspace symlinks.
- [x] **Task 5.4**: Run `npm run db:generate` to regenerate Prisma client.

---

## Phase 6: Verification & Smoke Testing
- [x] **Task 6.1**: Test `@flowhrms/web` TypeScript compile:
  ```powershell
  npm run typecheck --workspace=@flowhrms/web
  ```
- [x] **Task 6.2**: Test `@flowhrms/mobile` TypeScript compile:
  ```powershell
  npm run typecheck --workspace=@flowhrms/mobile
  ```
- [x] **Task 6.3**: Test monorepo-wide typecheck across all workspaces:
  ```powershell
  npm run typecheck
  ```
- [x] **Task 6.4**: Verify Prisma client generation to `apps/web/src/generated/prisma`.
