import { expect, it } from 'vitest';
import { Button } from '@vase-ui/vue/button';
import { createRenderer, fieldsetDisabledTests, hydrate, renderOnServer } from '#test-utils';
import ButtonFieldsetHydration from './ButtonFieldsetHydration.test.vue';

const { render } = createRenderer();

fieldsetDisabledTests({
  render,
  part: (props, slots) => <Button {...props} v-slots={slots} />,
  root: (children) => children,
});

it('VUE-112: hydrates the native button parts before it reads the fieldset', async () => {
  const serverHtml = await renderOnServer('src/button/ButtonFieldsetHydration.test.vue');
  expect(serverHtml).not.toContain('data-disabled');
  const { container } = await hydrate(ButtonFieldsetHydration, { serverHtml });
  const buttons = container.querySelectorAll('button');
  expect(buttons).toHaveLength(11);
  for (const button of buttons) {
    expect(button).toHaveAttribute('data-disabled');
    expect(button.textContent).toBe('true');
  }
});

it('VUE-112: shows the state of a disabled Fieldset.Root in the server HTML', async () => {
  const props = { fieldsetRoot: true };
  const serverHtml = await renderOnServer('src/button/ButtonFieldsetHydration.test.vue', props);
  const server = document.createElement('template');
  server.innerHTML = serverHtml;
  const { container } = await hydrate(ButtonFieldsetHydration, { serverHtml, props });
  for (const buttons of [
    server.content.querySelectorAll('button'),
    container.querySelectorAll('button'),
  ]) {
    expect(buttons).toHaveLength(11);
    for (const button of buttons) {
      // The DOM matchers refuse an element of a template, which has no window.
      expect(button.hasAttribute('data-disabled')).toBe(true);
      expect(button.textContent).toBe('true');
    }
  }
});
