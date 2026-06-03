// @ts-nocheck
import { defineConfig } from "@playwright/test";

const expoPort = process.env.PLAYWRIGHT_EXPO_PORT || "8082";

export default defineConfig({
  testDir: "tests/playwright",
  timeout: 30_000,
  expect: { timeout: 5000 },
  reporter: "list",
  projects: [
    {
      name: "edge",
      use: {
        browserName: "chromium",
        channel: "msedge",
      },
    },
  ],
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 0,
    baseURL: `http://localhost:${expoPort}`,
  },
  webServer: {
    // Pass explicit port and non-interactive flags so Expo won't prompt for a port.
    // The port can be overridden with the PLAYWRIGHT_EXPO_PORT env var.
    command: `npm run web -- --port ${expoPort} --non-interactive`,
    url: `http://localhost:${expoPort}`,
    reuseExistingServer: true,
    timeout: 300_000,
    env: {
      EXPO_NO_OPEN_BROWSER: "1",
      BROWSER: "none",
    },
  },
});
