import type { BrowserCommand } from 'vitest/node';

export const collectGarbage: BrowserCommand = async ({ page }) => {
  await page.requestGC();
};
