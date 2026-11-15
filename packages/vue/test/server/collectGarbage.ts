import type { BrowserCommand } from 'vitest/node';

/**
 * A Vitest browser command. It asks the browser of the test page for a full garbage collection and
 * a cycle collection, through `page.requestGC()` of Playwright.
 */
export const collectGarbage: BrowserCommand<[]> = async (context) => {
  if (context.provider.name === 'playwright') {
    await (context as unknown as { page: { requestGC(): Promise<void> } }).page.requestGC();
  }
};
