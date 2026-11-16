import { expect, it } from 'vitest';
import { Button } from '@vase-ui/vue/button';
import { hydrate, renderOnServer } from '#test-utils';
import { fieldsetDisabledTests } from '../../test/fieldsetDisabledTests';
import ButtonFieldsetHydration from './ButtonFieldsetHydration.test.vue';

fieldsetDisabledTests({
  part: (props, slots) => <Button {...props} v-slots={slots} />,
  root: (children) => children,
});

it('VUE-112: hydrates the native button parts before it reads the fieldset', async () => {
  const serverHtml = await renderOnServer('src/button/ButtonFieldsetHydration.test.vue');
  expect(serverHtml).not.toContain('data-disabled');
  const { container } = await hydrate(ButtonFieldsetHydration, { serverHtml });
  const buttons = container.querySelectorAll('button');
  expect(buttons).toHaveLength(12);
  for (const button of buttons) {
    expect(button).toHaveAttribute('data-disabled');
    expect(button.textContent).toBe('true');
  }
});
