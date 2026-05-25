import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.{test,spec}.ts"],
    setupFiles: ["src/test/setup.ts"],
    env: {
      NODE_ENV: "test",
      DB_PATH: ":memory:", // use in-memory SQLite for tests
      DB_DROP_SCHEMA: "false",
      LOG_LEVEL: "error"
    }
  }
});
