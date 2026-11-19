import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  workers: 2,
  snapshotPathTemplate: "{testDir}/reference/{arg}{ext}",
  updateSnapshots: "none",
  use: {
    baseURL,
    browserName: "chromium",
    deviceScaleFactor: 1,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort",
    url: baseURL,
  },
});
