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
