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
    const isDirty = (testId: string) =>
      document.querySelector(`[data-testid="${testId}"]`)?.hasAttribute('data-dirty') ?? false;
    const form = document.querySelector<HTMLFormElement>('[data-testid="form"]') ?? undefined;
    return {
      formData: Array.from(
        new FormData(form),
        ([name, value]) => `${name}=${typeof value === 'string' ? value : value.name}`,
      ),
      models: JSON.parse(read('models')) as unknown,
      changes: JSON.parse(read('changes')) as unknown,
      dirty: { news: isDirty('news-field'), note: isDirty('note-field') },
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

    for (const label of ['news-label', 'letter-a-label', 'letter-b-label', 'size-l-label']) {
      await page.getByTestId(label).click();
    }
    await page.getByTestId('note').fill('typed');
    // Chromium saves the value of an input only when it differs from its `value` attribute, and
    // Vue writes that attribute with each value of the slider. A program writes the inputs with no
    // event, so Chromium saves them. Both values are above the old value of the second thumb.
    await page.evaluate(() => {
      const values = ['85', '95'];
      document.querySelectorAll<HTMLInputElement>('input[name="range"]').forEach((input, index) => {
        input.value = values[index] ?? input.value;
      });
    });
    await page.getByTestId('away').click();
    await page.waitForURL('**/away.html');

    await page.goBack();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );

    // A checked input gives the `pageshow` event to its change. The second change of the group
    // holds both items, so the group had the first change in its props.
    expect(await readPage(page)).toEqual({
      formData: [
        'news=on',
        'letters=a',
        'letters=b',
        'size=l',
        'note=typed',
        'range=85',
        'range=95',
      ],
      models: { letters: ['a', 'b'], size: 'l', range: [85, 95] },
      changes: {
        news: ['true (pageshow)'],
        letters: ['a (pageshow)', 'a,b (pageshow)'],
        size: ['l (pageshow)'],
        note: ['typed (input)'],
        range: ['85,95 (input)'],
      },
      dirty: { news: true, note: true },
    });
    expect(messages).toEqual([]);
  });
});
