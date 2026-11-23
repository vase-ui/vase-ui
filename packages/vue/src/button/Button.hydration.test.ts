import { describe, expect, inject, test } from 'vitest';
import { nextTick, reactive } from 'vue';
import { userEvent } from 'vitest/browser';
import ButtonAsComponent from '../../test/fixtures/ButtonAsComponent.vue';
import ButtonAsInput from '../../test/fixtures/ButtonAsInput.vue';
import ButtonInSlot from '../../test/fixtures/ButtonInSlot.vue';
import Buttons from '../../test/fixtures/Buttons.vue';
import ButtonsInFieldset from '../../test/fixtures/ButtonsInFieldset.vue';
import ButtonLazyHydration from '../../test/fixtures/ButtonLazyHydration.vue';
import { hydrate, renderOnServer, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

describe('server render and hydration', () => {
  test.each([
    { name: 'an enabled button', attrs: {}, attributes: ['type'] },
    { name: 'a disabled button', attrs: { disabled: true }, attributes: ['disabled', 'type'] },
    {
      name: 'a disabled button that keeps the focus',
      attrs: { disabled: true, focusableWhenDisabled: true },
      attributes: ['aria-disabled', 'type'],
    },
  ])(
    'the server HTML of $name has its content, type="button" and the attributes of its state, with no mismatch',
    async ({ attrs, attributes }) => {
      const props = { buttons: [attrs] };
      const root = await renderOnServer('Buttons', props);
      const button = root.querySelector('.Ancestor > button')!;
      expect(button.getAttributeNames()).toEqual(attributes);
      expect(button.getAttribute('aria-disabled')).toBe(
        attributes.includes('aria-disabled') ? 'true' : null,
      );
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveTextContent(`Button 0 ${String(!!attrs.disabled)}`);
      hydrate(Buttons, props, root);
      await nextTick();
      expect(root.querySelector('.Ancestor > button')).toBe(button);
      expect(button.getAttributeNames()).toEqual(attributes);
      expect(button).toHaveAttribute('type', 'button');
    },
  );

  // The element of the `element` slot and of a component in `as` is known after the mount.
  const PLACES = [
    { place: 'a <span> in the element slot', fixture: 'ButtonInSlot', tag: 'span' },
    { place: 'a <button> in the element slot', fixture: 'ButtonInSlot', tag: 'button' },
    { place: 'a <div> component in `as`', fixture: 'ButtonAsComponent', tag: 'div' },
    { place: 'a <button> component in `as`', fixture: 'ButtonAsComponent', tag: 'button' },
  ];
  const STATES = [
    {
      name: 'enabled',
      attrs: {},
      server: ['role', 'tabindex', 'type'],
      tabindex: '0',
      onButton: ['type'],
      onOther: ['role', 'tabindex'],
    },
    {
      name: 'disabled',
      attrs: { disabled: true },
      server: ['aria-disabled', 'disabled', 'role', 'tabindex', 'type'],
      tabindex: '-1',
      onButton: ['disabled', 'type'],
      onOther: ['aria-disabled', 'role', 'tabindex'],
    },
    {
      name: 'disabled with the focus',
      attrs: { disabled: true, focusableWhenDisabled: true },
      server: ['aria-disabled', 'role', 'tabindex', 'type'],
      tabindex: '0',
      onButton: ['aria-disabled', 'type'],
      onOther: ['aria-disabled', 'role', 'tabindex'],
    },
  ];
  // StyledButton has a class of its own.
  const namesOf = (element: Element) =>
    element
      .getAttributeNames()
      .filter((name) => name !== 'class')
      .sort();

  test.each(PLACES.flatMap((place) => STATES.map((state) => ({ ...place, ...state }))))(
    'VUE-233: $place, $name: the server HTML suits a <button> and each other element, and the mount keeps the attributes of the element, with no mismatch',
    async ({ fixture, tag, attrs, server, tabindex, onButton, onOther }) => {
      const props =
        fixture === 'ButtonInSlot' ? { scene: { tag }, attrs } : { component: tag, attrs };
      const root = await renderOnServer(fixture, props);
      const element = root.querySelector(tag)!;
      expect(namesOf(element)).toEqual(server);
      expect(element).toHaveAttribute('tabindex', tabindex);
      hydrate(fixture === 'ButtonInSlot' ? ButtonInSlot : ButtonAsComponent, props, root);
      await nextTick();
      await nextTick();
      expect(root.querySelector(tag)).toBe(element);
      expect(namesOf(element)).toEqual(tag === 'button' ? onButton : onOther);
    },
  );

  // In a Vapor app, Vue 3.6 does not hydrate this async component at the focus, and the unmount of
  // the app throws.
  test.skipIf(inject('app').startsWith('vapor'))(
    'VUE-233: before a lazy hydration, Tab reaches a <div> component in `as`, and its focus starts the hydration',
    async () => {
      const root = await renderOnServer('ButtonLazyHydration');
      hydrate(ButtonLazyHydration, {}, root);
      // The loader of the async component resolves, and the component waits for a focus.
      await settle();
      const button = root.querySelector('div')!;
      // The mount removes `type` from a <div>.
      expect(button).toHaveAttribute('type', 'button');
      root.querySelector<HTMLInputElement>('.Before')!.focus();
      await userEvent.keyboard('{Tab}');
      expect(document.activeElement).toBe(button);
      await waitFor(() => expect(button.getAttributeNames().sort()).toEqual(['role', 'tabindex']));
      expect(document.activeElement).toBe(button);
    },
  );

  test('an <input> in `as` has the attributes of a native button in the server HTML, and hydrates with no message', async () => {
    const props = { disabled: true };
    const root = await renderOnServer('ButtonAsInput', props);
    const input = root.querySelector('input')!;
    const attributes = ['disabled', 'type', 'value'];
    expect(input.getAttributeNames().sort()).toEqual(attributes);
    expect(input).toHaveAttribute('type', 'submit');
    hydrate(ButtonAsInput, props, root);
    await nextTick();
    expect(root.querySelector('input')).toBe(input);
    expect(input.getAttributeNames().sort()).toEqual(attributes);
  });

  test('the server HTML has the state of a disabled Fieldset.Root, also in Fieldset.Legend, but not for an element of the slot, which the browser disables if it is a <button>; a native disabled fieldset and a native legend give theirs after the mount', async () => {
    const rootScene = reactive({ kind: 'root', disabled: true, ownDisabled: false });
    const root = await renderOnServer('ButtonsInFieldset', { scene: rootScene });
    expect(root.querySelector('.Native')).toHaveTextContent('Native true');
    expect(root.querySelector('.Native')).toHaveAttribute('disabled');
    expect(root.querySelector('.InLegend')).toHaveTextContent('Legend true');
    expect(root.querySelector('.InNativeLegend')).toHaveTextContent('Native legend true');
    // The fieldset disables a <button> of the slot, and no other element. Tab reaches the <span>.
    const custom = root.querySelector('.Custom')!;
    expect(custom).toHaveTextContent('Custom false');
    expect(custom).toHaveAttribute('tabindex', '0');
    const slotButton = root.querySelector('.SlotButton')!;
    expect(slotButton).toHaveTextContent('Slot button false');
    expect(slotButton).not.toHaveAttribute('disabled');
    expect(slotButton.matches(':disabled')).toBe(true);
    hydrate(ButtonsInFieldset, { scene: rootScene }, root);
    await settle();
    expect(root.querySelector('.Native')).toHaveTextContent('Native true');
    expect(root.querySelector('.InLegend')).toHaveTextContent('Legend true');
    expect(custom).toHaveTextContent('Custom false');
    expect(custom).toHaveAttribute('tabindex', '0');
    expect(root.querySelector('.SlotButton')).toBe(slotButton);
    await waitFor(() => expect(slotButton).toHaveTextContent('Slot button true'));
    expect(slotButton).toHaveAttribute('disabled');
    await waitFor(() =>
      expect(root.querySelector('.InNativeLegend')).toHaveTextContent('Native legend false'),
    );

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
