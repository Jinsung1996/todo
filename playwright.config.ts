import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      // Empty string wins over .env.local's real MONGODB_URI (Next.js env
      // loading never overrides a key already present in process.env), so
      // e2e always runs against the in-memory DB, never the real Atlas cluster.
      MONGODB_URI: "",
      ALLOW_TEST_LOGIN: "1",
    },
  },
  use: {
    baseURL: "http://localhost:3000",
  },
});
