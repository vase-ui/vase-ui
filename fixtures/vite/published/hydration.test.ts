import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { expect, it, onTestFinished, vi } from 'vitest';
import { createSSRApp, version } from 'vue';
import { renderToString } from 'vue/server-renderer';
import App from './App.vue';

it('hydrates the built Toggle and a wrapper of it, and forwards the first update, slot state and element', async () => {
  const expectedVersion = import.meta.env.MODE === 'vapor' ? '3.6.0-rc.15' : '3.5.46';
  expect(version).toBe(expectedVersion);
  using warn = vi.spyOn(console, 'warn');
  using error = vi.spyOn(console, 'error');
  const html = await renderToString(createSSRApp(App));
  expect(warn).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();

  const browser = await chromium.launch();
  onTestFinished(() => browser.close());
  const page = await browser.newPage();
  const messages: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      messages.push(message.text());
    }
  });
  page.on('pageerror', (error) => messages.push(error.message));
  await page.setContent(`<div id="app">${html}</div>`);
  const output = page.locator('output');
  expect(await output.count()).toBe(0);
  const toggle = page.getByRole('button', { name: 'Off' });
  expect(await toggle.getAttribute('aria-pressed')).toBe('false');
  const serverButton = await toggle.elementHandle();
  await page.addScriptTag({ path: resolve(import.meta.dirname, 'dist/client.js') });
  expect(await toggle.evaluate((element, original) => element === original, serverButton)).toBe(
    true,
  );
  expect(await output.count()).toBe(0);

  await toggle.click();
  const pressed = page.getByRole('button', { name: 'On', pressed: true });
  expect(await output.allTextContents()).toEqual([`Vue ${expectedVersion} emitted [true]`]);
  expect(await pressed.count()).toBe(1);
  await page.getByRole('button', { name: 'Focus the toggle' }).click();
  expect(await serverButton.evaluate((element) => element === document.activeElement)).toBe(true);

  // A wrapper that declares the props of the part gives them the defaults of the part.
  const wrapper = page.getByRole('button', { name: 'Wrapper released' });
  expect(await wrapper.getAttribute('class')).toBe('size-sm');
  await wrapper.click();
  expect(await page.getByRole('button', { name: 'Wrapper pressed', pressed: true }).count()).toBe(
    1,
  );
  expect(await page.locator('#wrapper-updates').textContent()).toBe('[true]');
  expect(messages).toEqual([]);
});
