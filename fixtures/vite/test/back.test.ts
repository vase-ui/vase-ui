import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import type { Page } from 'playwright-core';
import { preview } from 'vite';
import type { PreviewServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

function readPage(page: Page) {
  return page.evaluate(() => {
    const read = (testId: string) =>
      document.querySelector(`[data-testid="${testId}"]`)?.textContent ?? '';
    const form = document.querySelector<HTMLFormElement>('[data-testid="form"]') ?? undefined;
    return {
      formData: Array.from(
        new FormData(form),
        ([name, value]) => `${name}=${typeof value === 'string' ? value : value.name}`,
      ),
      models: JSON.parse(read('models')) as unknown,
      changes: JSON.parse(read('changes')) as unknown,
    };
  });
}

// An app that mounts in its entry module, as `create-vue` makes it. Chromium restores the form
// state of such a page after the mount, before `pageshow`, with no event on the inputs.
describe('VUE-81: a page that mounts before Chromium restores its form state', () => {
  let server: PreviewServer;
  let origin: string;

  beforeAll(async () => {
    server = await preview({
      root,
      logLevel: 'silent',
      preview: { host: '127.0.0.1', port: 0, strictPort: false },
    });
    origin = server.resolvedUrls?.local[0] ?? '';
  });

  afterAll(async () => {
    await server.close();
  });

  it('gives each part the state that Chromium restores after a move back', async () => {
    const browser = await chromium.launch();
    onTestFinished(() => browser.close());
    const page = await browser.newPage();
    const messages: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'warning' || message.type() === 'error') {
        messages.push(`console ${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => {
      messages.push(`page error: ${error.message}`);
    });
    await page.goto(origin);

    // Chromium saves a date input also when its value equals its `value` attribute.
    await page.getByTestId('when').locator('input[data-type="month"]').click();
    await page.keyboard.type('12252026');
    await page.getByTestId('away').click();
    await page.waitForURL('**/away.html');

    await page.goBack();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );

    expect(await readPage(page)).toEqual({
      formData: ['when=2026-12-25'],
      models: { when: '2026-12-25' },
      changes: {
        when: ['2026-12-25 (input)'],
      },
    });
    expect(messages).toEqual([]);
  });
});
