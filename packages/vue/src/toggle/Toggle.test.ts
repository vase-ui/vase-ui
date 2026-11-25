import { describe, expect, inject, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { markRaw, nextTick, reactive } from 'vue';
import { Toggle } from '@vase-ui/vue/toggle';
import StyledButton from '../../test/fixtures/StyledButton.vue';
import ToggleInSlot from '../../test/fixtures/ToggleInSlot.vue';
import Toggles from '../../test/fixtures/Toggles.vue';
import TogglesInFieldset from '../../test/fixtures/TogglesInFieldset.vue';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

/** Attributes of a toggle that write each event in `log`, with `v-model` when `write`. */
function record(log: string[], attrs: Record<string, unknown> = {}, write = false) {
  const box: Record<string, unknown> = reactive({
    onPressedChange: (pressed: boolean) => log.push(`pressedChange ${pressed}`),
    ...attrs,
  });
  box['onUpdate:modelValue'] = (pressed: boolean) => {
    log.push(`update ${pressed}`);
    if (write) box.modelValue = pressed;
  };
  return box;
}

async function mountToggles(...toggles: Record<string, unknown>[]) {
  const { root } = mount(Toggles, { toggles });
  await nextTick();
  return {
    root,
    form: root.querySelector('form')!,
    before: root.querySelector<HTMLInputElement>('#before')!,
    toggles: [...root.querySelectorAll<HTMLElement>('.Ancestor > *')],
  };
}

/** Mounts a `Toggle` whose `element` slot renders `tag`. The part reads its element at the mount. */
async function mountInSlot(tag: 'span' | 'button' | 'styled', attrs: Record<string, unknown> = {}) {
  const { root, exposed } = mount(ToggleInSlot, { scene: { tag }, attrs: reactive(attrs) });
  await nextTick();
  return { exposed, element: root.querySelector<HTMLElement>('.Ancestor > *')! };
}

test('the project compiles Toggle and the fixtures in the modes of its app', () => {
  const app = inject('app');
  // The compiler of Vue marks a Vapor component with `__vapor`.
  const isVapor = (component: object) => '__vapor' in component;
  expect(isVapor(Toggle)).toBe(app === 'vapor' || app === 'vdom-interop');
  expect(isVapor(Toggles)).toBe(app.startsWith('vapor'));
});

describe('the element', () => {
  test('is one button with type="button", aria-pressed and the attributes of the developer, and no data or tabindex attribute', async () => {
    const onClick = vi.fn();
    const { toggles } = await mountToggles({ class: 'Toggle', 'aria-label': 'Bold', onClick });
    const [toggle] = toggles;
    expect(toggle!.localName).toBe('button');
    expect(toggle!.getAttributeNames().sort()).toEqual([
      'aria-label',
      'aria-pressed',
      'class',
      'type',
    ]);
    expect(toggle).toHaveAttribute('type', 'button');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    toggle!.click();
    await nextTick();
    expect(onClick).toHaveBeenCalledOnce();
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('a type and a form of the developer reach the element and win', async () => {
    const { toggles } = await mountToggles({ type: 'submit', form: 'order' });
    expect(toggles[0]).toHaveAttribute('type', 'submit');
    expect(toggles[0]).toHaveAttribute('form', 'order');
  });

  test('the element slot renders the markup of the developer with the state; a template ref reaches the element', async () => {
    const { element, exposed } = await mountInSlot('button', { defaultPressed: true });
    expect(element.localName).toBe('button');
    expect(exposed.toggle.element).toBe(element);
    expect(element).toHaveAttribute('type', 'button');
    expect(element).toHaveAttribute('aria-pressed', 'true');
    expect(element.querySelector('.State')).toHaveTextContent('true false');
  });

  test.each([
    { name: 'a <span> in the element slot', mountToggle: () => mountInSlot('span') },
    {
      name: 'a tag in as',
      mountToggle: async () => ({ element: (await mountToggles({ as: 'span' })).toggles[0]! }),
    },
  ])(
    '$name gets the role button, a tab stop and aria-pressed, and no type; Enter and Space press it',
    async ({ mountToggle }) => {
      const { element } = await mountToggle();
      expect(element.localName).toBe('span');
      expect(element.getAttributeNames().sort()).toEqual(['aria-pressed', 'role', 'tabindex']);
      expect(element).toHaveAttribute('role', 'button');
      expect(element).toHaveAttribute('tabindex', '0');
      element.focus();
      await userEvent.keyboard('{Enter}');
      expect(element).toHaveAttribute('aria-pressed', 'true');
      await userEvent.keyboard(' ');
      expect(element).toHaveAttribute('aria-pressed', 'false');
    },
  );

  test.each([
    { name: 'the element slot', mountToggle: () => mountInSlot('styled') },
    {
      name: 'as',
      mountToggle: async () => {
        const { toggles } = await mountToggles({ as: markRaw(StyledButton) });
        return { element: toggles[0]! };
      },
    },
  ])('a button component in $name gets type="button" and no role', async ({ mountToggle }) => {
    const { element } = await mountToggle();
    expect(element).toHaveClass('StyledButton');
    expect(element.getAttributeNames().sort()).toEqual(['aria-pressed', 'class', 'type']);
  });
});

describe('the pressed state', () => {
  test('a press emits pressedChange and then update:modelValue; Enter and Space press a native toggle', async () => {
    const log: string[] = [];
    const { toggles } = await mountToggles(record(log, { defaultPressed: true }));
    const [toggle] = toggles;
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(toggle!);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    toggle!.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(log).toEqual([
      'pressedChange false',
      'update false',
      'pressedChange true',
      'update true',
      'pressedChange false',
      'update false',
    ]);
  });

  test('a controlled toggle shows its prop: v-model follows a press, and with no write the toggle stays as it was', async () => {
    const log: string[] = [];
    const bound = record(log, { modelValue: false }, true);
    const refused = record([], { modelValue: false });
    const { toggles } = await mountToggles(bound, refused);
    await userEvent.click(toggles[0]!);
    await userEvent.click(toggles[1]!);
    await nextTick();
    expect(bound.modelValue).toBe(true);
    expect(toggles[0]).toHaveAttribute('aria-pressed', 'true');
    expect(toggles[1]).toHaveAttribute('aria-pressed', 'false');
    bound.modelValue = false;
    await nextTick();
    expect(toggles[0]).toHaveAttribute('aria-pressed', 'false');
    expect(log).toEqual(['pressedChange true', 'update true']);
  });

  test('a modelValue that becomes undefined leaves the toggle uncontrolled with its state', async () => {
    const attrs = reactive<Record<string, unknown>>({ modelValue: true });
    const { toggles } = await mountToggles(attrs);
    attrs.modelValue = undefined;
    await nextTick();
    expect(toggles[0]).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(toggles[0]!);
    expect(toggles[0]).toHaveAttribute('aria-pressed', 'false');
  });

  test('details.cancel() in pressedChange keeps the state and emits no update', async () => {
    const log: string[] = [];
    const attrs = record(log, {
      onPressedChange: (
        pressed: boolean,
        details: { cancel(): void; reason: string; event: Event },
      ) => {
        log.push(`pressedChange ${pressed} ${details.reason} ${details.event.type}`);
        details.cancel();
      },
    });
    const { toggles } = await mountToggles(attrs);
    await userEvent.click(toggles[0]!);
    expect(toggles[0]).toHaveAttribute('aria-pressed', 'false');
    expect(log).toEqual(['pressedChange true none click']);
  });

  test('preventDefault() in a click listener of the developer does not stop the change', async () => {
    const { toggles } = await mountToggles({ onClick: (event: Event) => event.preventDefault() });
    await userEvent.click(toggles[0]!);
    expect(toggles[0]).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('disabled', () => {
  test('a native toggle has disabled and aria-pressed, no aria-disabled; Tab passes it, and a press changes nothing', async () => {
    const log: string[] = [];
    const { before, toggles } = await mountToggles(record(log, { disabled: true }));
    const [toggle] = toggles;
    expect(toggle!.getAttributeNames().sort()).toEqual(['aria-pressed', 'disabled', 'type']);
    expect(toggle!.matches(':disabled')).toBe(true);
    expect(toggle!.querySelector('.State')).toHaveTextContent('false true');
    before.focus();
    await userEvent.keyboard('{Tab}');
    expect(toggle).not.toHaveFocus();
    await userEvent.click(toggle!, { force: true });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(log).toEqual([]);
  });

  test('an element that is not a button has aria-disabled and tabindex -1; a click, Enter and Space change nothing', async () => {
    const log: string[] = [];
    const { element } = await mountInSlot('span', record(log, { disabled: true }));
    expect(element).toHaveAttribute('aria-disabled', 'true');
    expect(element).toHaveAttribute('tabindex', '-1');
    await userEvent.click(element, { force: true });
    element.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(element).toHaveAttribute('aria-pressed', 'false');
    expect(log).toEqual([]);
  });

  test('VUE-237: a disabled toggle with focusableWhenDisabled keeps its tab stop and the focus, has aria-disabled, and a press, Enter or Space does not change it', async () => {
    const log: string[] = [];
    const { before, toggles } = await mountToggles(
      record(log, { disabled: true, focusableWhenDisabled: true }),
      { focusableWhenDisabled: true },
    );
    const [disabledToggle, enabledToggle] = toggles;
    expect(disabledToggle!.getAttributeNames().sort()).toEqual([
      'aria-disabled',
      'aria-pressed',
      'type',
    ]);
    expect(disabledToggle).toHaveAttribute('aria-disabled', 'true');
    expect(disabledToggle!.matches(':disabled')).toBe(false);
    expect(disabledToggle!.querySelector('.State')).toHaveTextContent('false true');
    before.focus();
    await userEvent.keyboard('{Tab}');
    expect(disabledToggle).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(disabledToggle).toHaveFocus();
    await userEvent.click(disabledToggle!, { force: true });
    expect(disabledToggle).toHaveAttribute('aria-pressed', 'false');
    expect(log).toEqual([]);

    expect(enabledToggle).not.toHaveAttribute('aria-disabled');
    await userEvent.click(enabledToggle!);
    expect(enabledToggle).toHaveAttribute('aria-pressed', 'true');

    const span = await mountInSlot('span', { disabled: true, focusableWhenDisabled: true });
    expect(span.element).toHaveAttribute('aria-disabled', 'true');
    expect(span.element).toHaveAttribute('tabindex', '0');
    span.element.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(span.element).toHaveAttribute('aria-pressed', 'false');
  });

  test('a disabled toggle with focusableWhenDisabled and type="submit" ignores its label and submits no form at a press, Space, Enter or Enter in a text field', async () => {
    const log: string[] = [];
    const { root } = mount(Toggles, {
      labelFor: 'submit-toggle',
      toggles: [
        record(log, {
          id: 'submit-toggle',
          type: 'submit',
          disabled: true,
          focusableWhenDisabled: true,
        }),
      ],
    });
    await nextTick();
    const form = root.querySelector('form')!;
    const before = root.querySelector<HTMLInputElement>('#before')!;
    const toggle = root.querySelector<HTMLElement>('#submit-toggle')!;
    const label = root.querySelector<HTMLLabelElement>('#toggle-label')!;
    const submits = vi.fn();
    form.addEventListener('submit', submits);

    expect(toggle).toHaveAttribute('aria-disabled', 'true');
    expect(toggle).not.toHaveAttribute('disabled');
    await userEvent.click(label, { force: true });
    await userEvent.click(toggle, { force: true });
    toggle.focus();
    expect(toggle).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    before.focus();
    await userEvent.keyboard('{Enter}');
    expect(submits).not.toHaveBeenCalled();
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(log).toEqual([]);
  });

  test('a toggle that the page disables while it has the focus keeps the focus', async () => {
    const log: string[] = [];
    const attrs = record(log, { disabled: false, focusableWhenDisabled: true });
    const { before, toggles } = await mountToggles(attrs);
    const [toggle] = toggles;
    before.focus();
    await userEvent.keyboard('{Tab}');
    expect(toggle).toHaveFocus();
    attrs.disabled = true;
    await settle();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await userEvent.click(toggle!, { force: true });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(log).toEqual([]);
  });
});

describe.each(['fieldset', 'root'] as const)('VUE-112: a disabled fieldset (%s)', (kind) => {
  test('a native toggle follows the fieldset and its own disabled holds; a toggle in the first legend and a <span> stay enabled', async () => {
    const scene = reactive({ kind, disabled: false, ownDisabled: false });
    const { root } = mount(TogglesInFieldset, { scene });
    const find = (name: string) => root.querySelector<HTMLElement>(`.${name}`)!;
    await settle();
    expect(find('Native')).toHaveTextContent('Native false');
    scene.disabled = true;
    await waitFor(() => expect(find('Native')).toHaveTextContent('Native true'));
    expect(find('Native').matches(':disabled')).toBe(true);
    expect(find('InLegend')).toHaveTextContent('Legend false');
    expect(find('Custom')).toHaveTextContent('Custom false');
    expect(find('Custom')).not.toHaveAttribute('aria-disabled');
    await userEvent.click(find('Custom'));
    expect(find('Custom')).toHaveAttribute('aria-pressed', 'true');

    scene.ownDisabled = true;
    scene.disabled = false;
    await settle();
    expect(find('Native')).toHaveTextContent('Native true');
  });

  test('a native toggle with focusableWhenDisabled still gets disabled and leaves the tab order', async () => {
    const scene = reactive({ kind, disabled: true, ownDisabled: false, focusable: true });
    const { root } = mount(TogglesInFieldset, { scene });
    const find = (name: string) => root.querySelector<HTMLElement>(`.${name}`)!;
    await settle();
    expect(find('Native').matches(':disabled')).toBe(true);
    expect(find('Native')).not.toHaveAttribute('aria-disabled');
    find('InLegend').focus();
    await userEvent.keyboard('{Tab}');
    expect(find('Native')).not.toHaveFocus();
  });
});
