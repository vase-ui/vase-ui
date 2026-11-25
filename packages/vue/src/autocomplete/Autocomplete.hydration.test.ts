import { expect, test } from 'vitest';
import { nextTick } from 'vue';
import AutocompleteParts from '../../test/fixtures/AutocompleteParts.vue';
import { hydrate, renderOnServer } from '../../test/render';
import { waitFor } from '../../test/waitFor';

test('the server HTML has one name: the input; with the input in the popup, the root adds its inputs after the mount', async () => {
  const props = { root: { name: 'tag', defaultValue: 'fix' } };
  const root = await renderOnServer('AutocompleteParts', props);
  expect(root.querySelectorAll('[name="tag"]')).toHaveLength(1);
  expect(root.querySelector('[name="tag"]')).toHaveAttribute('role', 'combobox');
  hydrate(AutocompleteParts, props, root);
  await nextTick();
  expect(root.querySelectorAll('[name="tag"]')).toHaveLength(1);

  const inPopup = { inputInPopup: true, root: { name: 'tag', defaultValue: 'fix' } };
  const second = await renderOnServer('AutocompleteParts', inPopup);
  expect(second.querySelectorAll('[name="tag"]')).toHaveLength(0);
  hydrate(AutocompleteParts, inPopup, second);
  await waitFor(() => expect(second.querySelectorAll('[name="tag"]')).toHaveLength(1));
});

test('a disabled portal of an open root renders the shown popup and backdrop in place with no `display: none`, and hydrates with no message', async () => {
  const props = {
    root: { defaultOpen: true },
    portal: { disabled: true },
    backdrop: {},
  };
  const root = await renderOnServer('AutocompleteParts', props);
  const popup = root.querySelector<HTMLElement>('[data-testid="popup"]')!;
  const backdrop = root.querySelector<HTMLElement>('[data-testid="backdrop"]')!;
  expect(popup.style.display).toBe('');
  expect(backdrop.style.display).toBe('');
  expect(popup.querySelectorAll('[role="option"]')).toHaveLength(4);
  hydrate(AutocompleteParts, props, root);
  await nextTick();
  expect(root.querySelector('[data-testid="popup"]')).toBe(popup);
  expect(root.querySelector('[data-testid="backdrop"]')).toBe(backdrop);
  expect(popup.style.display).toBe('');
  expect(backdrop.style.display).toBe('');
});
