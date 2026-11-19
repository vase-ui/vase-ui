import { describe, expect, test } from 'vitest';
import { nextTick, reactive } from 'vue';
import ButtonInSlot from '../../test/fixtures/ButtonInSlot.vue';
import Buttons from '../../test/fixtures/Buttons.vue';
import ButtonsInFieldset from '../../test/fixtures/ButtonsInFieldset.vue';
import { hydrate, renderOnServer, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

describe('server render and hydration', () => {
  test.each([
    { name: 'an enabled button', attrs: {}, attributes: [] as string[] },
    { name: 'a disabled button', attrs: { disabled: true }, attributes: ['disabled'] },
    {
      name: 'a disabled button that keeps the focus',
      attrs: { disabled: true, focusableWhenDisabled: true },
      attributes: ['aria-disabled'],
    },
  ])(
    'the server HTML of $name has its content and the attributes of its state, with no mismatch',
    async ({ attrs, attributes }) => {
      const props = { buttons: [attrs] };
      const root = await renderOnServer('Buttons', props);
      const button = root.querySelector('.Ancestor > button')!;
      expect(button.getAttributeNames()).toEqual(attributes);
      expect(button.getAttribute('aria-disabled')).toBe(
        attributes.includes('aria-disabled') ? 'true' : null,
      );
      expect(button).toHaveTextContent(`Button 0 ${String(!!attrs.disabled)}`);
      hydrate(Buttons, props, root);
      await nextTick();
      expect(root.querySelector('.Ancestor > button')).toBe(button);
      expect(button.getAttributeNames()).toEqual(attributes);
    },
  );

  test('an element that is not a native button gets its role, tabindex and aria-disabled at the mount', async () => {
    const props = { scene: { tag: 'span' }, attrs: { disabled: true } };
    const root = await renderOnServer('ButtonInSlot', props);
    const span = root.querySelector('.Ancestor > span')!;
    expect(span.getAttributeNames()).toEqual(['disabled']);
    hydrate(ButtonInSlot, { ...props, scene: reactive(props.scene) }, root);
    await nextTick();
    await nextTick();
    expect(root.querySelector('.Ancestor > span')).toBe(span);
    expect(span.getAttributeNames().sort()).toEqual(['aria-disabled', 'role', 'tabindex']);
    expect(span).toHaveAttribute('tabindex', '-1');
  });

  test('the server HTML has the state of a disabled Fieldset.Root; a native disabled fieldset gives it after the mount', async () => {
    const rootScene = reactive({ kind: 'root', disabled: true, ownDisabled: false });
    const root = await renderOnServer('ButtonsInFieldset', { scene: rootScene });
    expect(root.querySelector('.Native')).toHaveTextContent('Native true');
    expect(root.querySelector('.Native')).toHaveAttribute('disabled');
    expect(root.querySelector('.InLegend')).toHaveTextContent('Legend false');
    hydrate(ButtonsInFieldset, { scene: rootScene }, root);
    await settle();
    expect(root.querySelector('.Native')).toHaveTextContent('Native true');

    const scene = reactive({ kind: 'fieldset', disabled: true, ownDisabled: false });
    const native = await renderOnServer('ButtonsInFieldset', { scene });
    const button = native.querySelector('.Native')!;
    expect(button).toHaveTextContent('Native false');
    hydrate(ButtonsInFieldset, { scene }, native);
    await settle();
    await waitFor(() => expect(button).toHaveTextContent('Native true'));
    expect(native.querySelector('.Native')).toBe(button);
  });
});
