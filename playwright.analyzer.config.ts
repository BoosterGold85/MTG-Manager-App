import { defineConfig } from '@playwright/test';
import original from './playwright.config';
export default defineConfig({
  ...original,
  testMatch: /(?:experimentalAnalyzer|analyzerRealDecks)\.spec\.ts/,
  workers: 1,
  use: { ...original.use, baseURL: 'http://127.0.0.1:4186' },
  webServer: { command: process.env.TEST_PRODUCTION ? 'npm run preview -- --port 4186 --strictPort' : 'npm run dev -- --config vite.analyzer.config.ts --port 4186 --strictPort', url: 'http://127.0.0.1:4186', reuseExistingServer: false },
});
