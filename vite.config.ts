import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const { API_PROXY_TARGET } = loadEnv(mode, process.cwd(), "API_");
  return {
    plugins: [react()],
    server: {
      proxy: API_PROXY_TARGET ? { "/v1": API_PROXY_TARGET } : undefined,
    },
    test: {
      include: ["src/**/*.test.{ts,tsx}", "tooling/**/*.test.ts"],
      environment: "jsdom",
      env: { TZ: "UTC" },
      setupFiles: ["./src/test/setup.ts"],
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/**/*.test.{ts,tsx}",
          "src/test/**",
          "src/**/generated/**",
          "src/**/*.d.ts",
        ],
        thresholds: { lines: 80, branches: 80 },
      },
    },
  };
});
