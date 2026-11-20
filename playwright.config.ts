import { defineConfig } from "@playwright/test";

const stackURL = process.env.SAGAPAY_BASE_URL;
const previewURL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  // The stack run covers what only the served image can show; the shell and
  // visual specs stay on the preview server, where they own their origin.
  ...(stackURL
    ? { testMatch: "**/{stack,session}.spec.ts" }
    : { testIgnore: "**/{stack,session}.spec.ts" }),
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  workers: 2,
  snapshotPathTemplate: "{testDir}/reference/{arg}{ext}",
  updateSnapshots: "none",
  use: {
    baseURL: stackURL || previewURL,
    browserName: "chromium",
    deviceScaleFactor: 1,
    trace: "retain-on-failure",
  },
  webServer: stackURL
    ? undefined
    : {
        command:
          "pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort",
        url: previewURL,
      },
});
