import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Tests exercise pure logic; strip the RSC-only guard import.
      "server-only": fileURLToPath(
        new URL("./src/tests/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/tests/**/*.test.ts"],
          exclude: ["src/tests/**/*-integration.test.ts"],
        },
      },
      {
        // The database tests share one Supabase session pool, which allows
        // 15 clients. Run side by side they ran out of connections, so
        // they run one file at a time (each still runs its own tests).
        extends: true,
        test: {
          name: "integration",
          include: ["src/tests/**/*-integration.test.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
