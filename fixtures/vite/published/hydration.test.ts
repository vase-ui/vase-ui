import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { expect, it, onTestFinished } from 'vitest';
import { createSSRApp, version } from 'vue';
import { renderToString } from 'vue/server-renderer';
import App from './App.vue';

it('hydrates the built Toggle and forwards its first update, slot state and element', async () => {
  const expectedVersion = import.meta.env.MODE === 'vapor' ? '3.6.0-rc.15' : '3.5.12';
  expect(version).toBe(expectedVersion);
  const app = createSSRApp(App);
  const messages: string[] = [];
  app.config.warnHandler = (message) => messages.push(message);
  const html = await renderToString(app);
  const browser = await chromium.launch();
  onTestFinished(() => browser.close());
  const page = await browser.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      messages.push(message.text());
    }
  });
  page.on('pageerror', (error) => messages.push(error.message));
  await page.setContent(`<div id="app">${html}</div>`);
  expect(await page.locator('output').count()).toBe(0);
  const toggle = page.getByRole('button', { name: 'Off' });
  expect(await toggle.count()).toBe(1);
  const serverButton = await toggle.elementHandle();
  await page.addScriptTag({ path: resolve(import.meta.dirname, 'dist/client.js') });
  expect(await toggle.evaluate((element, original) => element === original, serverButton)).toBe(
    true,
  );

  await toggle.click();
  const pressed = page.getByRole('button', { name: 'On', pressed: true });
  expect(await page.locator('output').allTextContents()).toEqual([
    `Vue ${expectedVersion} emitted true`,
  ]);
  expect(await pressed.count()).toBe(1);
  await page.getByRole('button', { name: 'Focus the toggle' }).click();
  expect(await pressed.evaluate((element) => element === document.activeElement)).toBe(true);
  expect(messages).toEqual([]);
});
