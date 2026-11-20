import { expect, it } from 'vitest';
import { hydrate, renderOnServer } from '#test-utils';
import NativeButtonFieldsetHydration from './NativeButtonFieldsetHydration.test.vue';

const FIXTURE = 'test/NativeButtonFieldsetHydration.test.vue';

it('VUE-112: hydrates the native button parts before it reads the fieldset', async () => {
  const serverHtml = await renderOnServer(FIXTURE);
  expect(serverHtml).not.toContain('data-disabled');
  const { container } = await hydrate(NativeButtonFieldsetHydration, { serverHtml });
  const buttons = container.querySelectorAll('button');
  expect(buttons.length).toBeGreaterThan(0);
  for (const button of buttons) {
    expect(button).toHaveAttribute('data-disabled');
    expect(button.textContent).toBe('true');
  }
});

it('VUE-112: shows the state of a disabled Fieldset.Root in the server HTML', async () => {
  const props = { fieldsetRoot: true };
  const serverHtml = await renderOnServer(FIXTURE, props);
  const server = document.createElement('template');
  server.innerHTML = serverHtml;
  const { container } = await hydrate(NativeButtonFieldsetHydration, { serverHtml, props });
  for (const buttons of [
    server.content.querySelectorAll('button'),
    container.querySelectorAll('button'),
  ]) {
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      // The DOM matchers refuse an element of a template, which has no window.
      expect(button.hasAttribute('data-disabled')).toBe(true);
      expect(button.textContent).toBe('true');
    }
  }
});
