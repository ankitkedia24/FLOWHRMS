# FlowHRMS Monorepo Architecture Specification

## 1. Executive Summary

This specification defines the structural and architectural migration of FlowHRMS from a single-app Next.js repository into an **npm workspaces monorepo** housing both the **Web Application (Next.js 16)** and the **Mobile Application (Expo React Native)** alongside shared domain packages.

---

## 2. Target Directory Hierarchy

```text
FLOWHRMS/
│
├── apps/
│   ├── web/                           # Next.js 16 App Router (Employee & Admin portal)
│   │   ├── src/                       # App routes, components, server actions, lib
│   │   ├── public/                    # Static assets & icons
│   │   ├── scripts/                   # Migration & utility scripts
│   │   ├── design/                    # Design token source JSONs
│   │   ├── next.config.ts             # Transpiles internal packages
│   │   ├── tsconfig.json              # Extends root / packages tsconfig
│   │   ├── postcss.config.mjs
│   │   ├── vitest.config.mts
│   │   └── package.json               # @flowhrms/web
│   │
│   └── mobile/                        # Expo React Native (iOS & Android)
│       ├── app/                       # Expo Router tab/stack routes
│       ├── components/                # Native UI components
│       ├── lib/                       # Supabase client, location, secure storage
│       ├── assets/                    # Mobile app splash, adaptive icons
│       ├── app.json                   # Expo manifest & permission strings
│       ├── eas.json                   # Cloud build profiles (no Android Studio)
│       ├── metro.config.js            # Monorepo-aware Metro bundler config
│       ├── tsconfig.json
│       └── package.json               # @flowhrms/mobile
│
├── packages/
│   ├── types/                         # Shared TypeScript interfaces & models
│   │   ├── src/
│   │   │   ├── attendance.ts          # Shift, punch context, status types
│   │   │   ├── session.ts             # AppSession, user, tenant membership
│   │   │   ├── leave.ts               # Leave balance, request types
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json               # @flowhrms/types
│   │
│   ├── validation/                    # Shared Zod schemas (Single Source of Truth)
│   │   ├── src/
│   │   │   ├── attendance.ts          # Check-in coordinate & accuracy schema
│   │   │   ├── leave.ts               # Apply leave schema
│   │   │   ├── auth.ts                # Sign-in & password schema
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json               # @flowhrms/validation
│   │
│   └── config/                        # Shared tooling configs (optional/future)
│       ├── tsconfig.base.json
│       └── eslint.base.js
│
├── prisma/                            # Centralized Database schema & migrations
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── prisma.config.ts
│
├── docs/                              # FlowHRMS documentation & pack specs
├── .gitignore                         # Monorepo-wide ignore rules
├── package.json                       # Root workspaces manifest & orchestration
├── package-lock.json
└── README.md
```

---

## 3. Package Definitions & Configurations

### 3.1 Root `package.json`
The root manages workspaces, shared tooling, and top-level scripts:

```json
{
  "name": "flowhrms-monorepo",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev:web": "npm run dev --workspace=@flowhrms/web",
    "dev:mobile": "npm run start --workspace=@flowhrms/mobile",
    "build:web": "npm run build --workspace=@flowhrms/web",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts",
    "lint": "npm run lint --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspace=@flowhrms/web"
  },
  "devDependencies": {
    "@prisma/adapter-pg": "^7.9.1",
    "@prisma/client": "^7.9.1",
    "prisma": "^7.9.1",
    "tsx": "^4.23.9",
    "typescript": "^5.0.0"
  }
}
```

---

### 3.2 Shared Packages

#### A. `@flowhrms/types` (`packages/types/package.json`)
```json
{
  "name": "@flowhrms/types",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

#### B. `@flowhrms/validation` (`packages/validation/package.json`)
```json
{
  "name": "@flowhrms/validation",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "zod": "^4.4.3"
  }
}
```

---

### 3.3 Application Configurations

#### A. Web App (`apps/web/next.config.ts`)
Next.js must transpile workspace packages:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@flowhrms/types", "@flowhrms/validation"],
  // Existing FlowHRMS Next.js configurations
};

export default nextConfig;
```

#### B. Mobile App Metro Bundler (`apps/mobile/metro.config.js`)
Expo's Metro bundler requires explicit configuration to watch and resolve files outside its directory:

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch monorepo root so symlinked packages in /packages are watched
config.watchFolders = [monorepoRoot];

// 2. Resolve modules from both local and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
```

---

## 4. Prisma & Database Handling

* `prisma/` remains at the monorepo root.
* Prisma Client generation will generate to `node_modules/@prisma/client` or `apps/web/src/generated/prisma`.
* `apps/web` accesses Prisma via root or symlinked dependency.

---

## 5. Security & Isolation Invariants

1. **Server-Only Leak Prevention:** `@flowhrms/types` and `@flowhrms/validation` MUST NEVER import `"server-only"`, `getDb`, or database connection strings. They contain **pure TypeScript types and pure Zod schemas**.
2. **Tenant ID Integrity:** Mobile app endpoints submit requests without client-spoofed `tenantId`. Handlers extract identity from the Supabase JWT.
