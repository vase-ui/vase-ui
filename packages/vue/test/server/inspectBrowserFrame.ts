import { PlaywrightBrowserProvider } from '@vitest/browser-playwright';
import type { BrowserCommand } from 'vitest/node';

export type FrameScenario =
  'current' | 'unnamed' | 'stale' | 'unrelated' | 'missing' | 'duplicate' | 'non-frame';

export interface FrameResult {
  text?: string | null;
  error?: string;
  elementLookups: number;
}

const CURRENT_FRAME =
  '<iframe data-vitest="true" name="vitest-iframe" srcdoc="<body>current</body>"></iframe>';

export const inspectBrowserFrame: BrowserCommand<[scenario: FrameScenario]> = async (
  { context },
  scenario,
): Promise<FrameResult> => {
  const page = await context.newPage();
  try {
    let elementLookups = 0;
    const lookupStarted = Promise.withResolvers<void>();
    const locator = page.locator.bind(page);
    page.locator = (selector, options) => {
      elementLookups += 1;
      lookupStarted.resolve();
      return locator(selector, options);
    };
    const commands = PlaywrightBrowserProvider.prototype.getCommandsContext.call(
      { getPage: () => page, contexts: new Map([['probe', context]]) },
      'probe',
    );

    if (scenario !== 'missing') {
      await page.setContent(CURRENT_FRAME);
      const [first] = page.mainFrame().childFrames();
      if (scenario === 'unnamed') {
        first.name = () => '';
      } else if (scenario === 'stale') {
        await page.setContent(CURRENT_FRAME);
        // The client can keep a removed frame after the browser has the next frame.
        first.isDetached = () => false;
        page.mainFrame().childFrames = () => [first];
        page.frame = () => first;
      } else if (scenario === 'unrelated') {
        await page.setContent('<iframe srcdoc="<body>other</body>"></iframe>' + CURRENT_FRAME);
        const [other] = page.mainFrame().childFrames();
        page.mainFrame().childFrames = () => [other];
      } else if (scenario === 'duplicate') {
        await page.setContent(CURRENT_FRAME + CURRENT_FRAME);
        const [duplicate] = page.mainFrame().childFrames();
        page.mainFrame().childFrames = () => [duplicate];
      } else if (scenario === 'non-frame') {
        await page.setContent('<div data-vitest="true"></div>');
      }
    }

    try {
      const pending = commands.frame();
      if (scenario === 'missing') {
        await Promise.race([lookupStarted.promise, pending]);
        await page.setContent(CURRENT_FRAME);
      }
      const frame = await pending;
      return { text: await frame.textContent('body'), elementLookups };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), elementLookups };
    }
  } finally {
    await page.close();
  }
};
