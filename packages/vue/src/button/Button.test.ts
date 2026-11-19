import { afterEach, describe, expect, inject, onTestFinished, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { Button } from '@vase-ui/vue/button';
import { expectNoAxeViolations } from '../../test/axe';
import ButtonInSlot from '../../test/fixtures/ButtonInSlot.vue';
import ButtonInTransition from '../../test/fixtures/ButtonInTransition.vue';
import ButtonParts from '../../test/fixtures/ButtonParts.vue';
import Buttons from '../../test/fixtures/Buttons.vue';
import ButtonsInFieldset from '../../test/fixtures/ButtonsInFieldset.vue';
import { mount, renderOnServer, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Tag = 'span' | 'a' | 'button' | 'input' | 'styled' | 'wrapped';

function mountButtons(...buttons: Record<string, unknown>[]) {
  const { root, exposed } = mount(Buttons, { buttons });
  return {
    root,
    exposed,
    form: root.querySelector('form')!,
    text: root.querySelector('input')!,
    ancestor: root.querySelector<HTMLElement>('.Ancestor')!,
    buttons: [...root.querySelectorAll<HTMLButtonElement>('.Ancestor > button')],
  };
}

/** Mounts a `Button` whose `element` slot renders `tag`. The part reads its element at the mount. */
async function mountInSlot(tag: Tag, attrs: Record<string, unknown> = {}) {
  const scene = reactive({ tag });
  const { root, exposed } = mount(ButtonInSlot, { scene, attrs: reactive(attrs) });
  await nextTick();
  const ancestor = root.querySelector<HTMLElement>('.Ancestor')!;
  return {
    scene,
    exposed,
    ancestor,
    form: root.querySelector('form')!,
    element: () => ancestor.firstElementChild as HTMLElement,
  };
}

/** The clicks that reach an ancestor in the capture phase, the element, and the ancestor in the bubble phase. */
function recordClicks(ancestor: Element, element: Element) {
  const log: string[] = [];
  ancestor.addEventListener('click', () => log.push('capture'), true);
  element.addEventListener('click', () => log.push('element'));
  ancestor.addEventListener('click', () => log.push('ancestor'));
  return log;
}

/**
 * For each Space keydown that reaches the window, whether a listener prevented its default. A
 * Space keydown that no listener prevents scrolls the page.
 */
function recordSpaceKeydowns() {
  const prevented: boolean[] = [];
  const record = (event: KeyboardEvent) => {
    if (event.key === ' ') prevented.push(event.defaultPrevented);
  };
  window.addEventListener('keydown', record);
  onTestFinished(() => window.removeEventListener('keydown', record));
  return prevented;
}

afterEach(() => {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
});

test('the project compiles Button and the fixtures in the modes of its app', () => {
  const app = inject('app');
  // The compiler of Vue marks a Vapor component with `__vapor`.
  const isVapor = (component: object) => '__vapor' in component;
  expect(isVapor(Button)).toBe(app === 'vapor' || app === 'vdom-interop');
  expect(isVapor(Buttons)).toBe(app.startsWith('vapor'));
});

describe('the element', () => {
  test('is one button with only the attributes of the developer, and it has no type', async () => {
    const onClick = vi.fn();
    const { buttons } = mountButtons({
      name: 'action',
      value: 'save',
      class: 'Button',
      'data-test': 'save',
      onClick,
    });
    await nextTick();
    const [button] = buttons;
    expect(button!.getAttributeNames().sort()).toEqual(['class', 'data-test', 'name', 'value']);
    expect(button).toHaveAttribute('class', 'Button');
    expect(button!.type).toBe('submit');
    button!.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  test('the element slot renders the markup of the developer with the state; a template ref reaches the element; Transition works', async () => {
    const { element, exposed } = await mountInSlot('span', { disabled: true });
    expect(element().localName).toBe('span');
    expect(exposed.button.element).toBe(element());
    expect(element().querySelector('.State')).toHaveTextContent('true');

    const { root } = mountButtons({ disabled: true });
    expect(root.querySelector('.State')).toHaveTextContent('true');

    const scene = reactive({ shown: false });
    const shown = mount(ButtonInTransition, { scene }).root;
    scene.shown = true;
    await nextTick();
    expect(shown.querySelector('button')).toHaveClass('v-enter-from', 'v-enter-active');
  });
});

describe('a form', () => {
  test('a Button with no type submits its form, and the submitter gives its name and value', async () => {
    const { form, buttons } = mountButtons({ name: 'action', value: 'save' });
    const submitters: (HTMLElement | null)[] = [];
    form.addEventListener('submit', (event) => submitters.push(event.submitter));
    await userEvent.click(buttons[0]!);
    expect(submitters).toEqual([buttons[0]]);
    expect([...new FormData(form, buttons[0])]).toEqual([['action', 'save']]);
  });
});

describe('disabled', () => {
  test('has the disabled attribute and no aria-disabled; Tab passes it, and a press runs no click listener', async () => {
    const onClick = vi.fn();
    const { text, buttons } = mountButtons({ disabled: true, onClick });
    await nextTick();
    const [button] = buttons;
    expect(button!.getAttributeNames()).toEqual(['disabled']);
    expect(button!.matches(':disabled')).toBe(true);
    text.focus();
    await userEvent.keyboard('{Tab}');
    expect(button).not.toHaveFocus();
    await userEvent.click(button!, { force: true });
    expect(onClick).not.toHaveBeenCalled();
  });

  test('follows a change of the prop', async () => {
    const attrs = reactive({ disabled: false });
    const { buttons } = mountButtons(attrs);
    await nextTick();
    const [button] = buttons;
    expect(button).not.toHaveAttribute('disabled');
    attrs.disabled = true;
    await nextTick();
    expect(button).toHaveAttribute('disabled');
    expect(button!.querySelector('.State')).toHaveTextContent('true');
    attrs.disabled = false;
    await nextTick();
    expect(button).not.toHaveAttribute('disabled');
  });
});

describe('disabled, and it keeps the focus', () => {
  const focusable = { disabled: true, focusableWhenDisabled: true };

  test('has aria-disabled and no disabled attribute, and Tab moves the focus to it', async () => {
    const { text, buttons } = mountButtons({ ...focusable });
    await nextTick();
    const [button] = buttons;
    expect(button!.getAttributeNames()).toEqual(['aria-disabled']);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button!.matches(':disabled')).toBe(false);
    text.focus();
    await userEvent.keyboard('{Tab}');
    expect(button).toHaveFocus();
  });

  test('keeps the focus when it becomes disabled in its own click listener, and runs no click listener after', async () => {
    const attrs: Record<string, unknown> = reactive({
      focusableWhenDisabled: true,
      disabled: false,
    });
    const onClick = vi.fn(() => (attrs.disabled = true));
    attrs.onClick = onClick;
    const { text, buttons } = mountButtons(attrs);
    const [button] = buttons;
    text.focus();
    await userEvent.keyboard('{Tab}');
    await userEvent.keyboard('{Enter}');
    await nextTick();
    expect(onClick).toHaveBeenCalledOnce();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(button).toHaveFocus();
    await userEvent.click(button!, { force: true });
    expect(onClick).toHaveBeenCalledOnce();
  });

  test('a press, Enter and Space run no click listener on the button and no bubbling click listener of an ancestor; a capture listener of an ancestor gets the click', async () => {
    const onClick = vi.fn();
    const { text, ancestor, buttons } = mountButtons({ ...focusable, onClick });
    const [button] = buttons;
    const log = recordClicks(ancestor, button!);
    text.focus();
    await userEvent.keyboard('{Tab}');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await userEvent.click(button!, { force: true });
    expect(log).toEqual(['capture', 'capture', 'capture']);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('does not submit its form, also not from Enter in a text field', async () => {
    const { form, text, buttons } = mountButtons({ ...focusable });
    const submits = vi.fn();
    form.addEventListener('submit', submits);
    const [button] = buttons;
    await userEvent.click(button!, { force: true });
    button!.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    text.focus();
    await userEvent.keyboard('{Enter}');
    expect(submits).not.toHaveBeenCalled();
  });

  test('runs the hover, focus, pointer and key listeners of the developer, and a keydown listener of an ancestor gets Escape', async () => {
    const listeners = {
      onMousemove: vi.fn(),
      onFocus: vi.fn(),
      onPointerdown: vi.fn(),
      onPointerup: vi.fn(),
      onKeydown: vi.fn(),
      onKeyup: vi.fn(),
    };
    const { text, ancestor, buttons } = mountButtons({ ...focusable, ...listeners });
    const keys: string[] = [];
    ancestor.addEventListener('keydown', (event) => keys.push(event.key));
    const [button] = buttons;
    await userEvent.hover(button!);
    await userEvent.click(button!, { force: true });
    text.focus();
    await userEvent.keyboard('{Tab}');
    await userEvent.keyboard('{Escape}');
    expect(listeners.onMousemove).toHaveBeenCalled();
    expect(listeners.onPointerdown).toHaveBeenCalledOnce();
    expect(listeners.onPointerup).toHaveBeenCalledOnce();
    expect(listeners.onFocus).toHaveBeenCalled();
    expect(listeners.onKeydown).toHaveBeenCalledOnce();
    expect(listeners.onKeyup).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'Escape' }));
    expect(keys).toEqual(['Escape']);
  });

  // A native disabled button gets the pointer events, and no `mousedown`, `mouseup` or `click`
  // (test/measurements/button.test.ts).
  test.each([
    { name: 'disabled', attrs: { disabled: true }, capture: [] },
    {
      name: 'disabled, with the focus',
      attrs: focusable,
      capture: ['mousedown', 'mouseup', 'click'],
    },
  ])(
    'a press gives the pointer events, and no mouse events to the button or to a bubbling listener of an ancestor: $name',
    async ({ attrs, capture }) => {
      const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      const listeners = Object.fromEntries(
        events.map((type) => [`on${type[0]!.toUpperCase()}${type.slice(1)}`, vi.fn()]),
      );
      const { ancestor, buttons } = mountButtons({ ...attrs, ...listeners });
      await nextTick();
      const [button] = buttons;
      const log: string[] = [];
      const child = button!.querySelector('.State')!;
      for (const type of events) {
        ancestor.addEventListener(type, () => log.push(`${type} capture`), true);
        ancestor.addEventListener(type, () => log.push(`${type} ancestor`));
        child.addEventListener(type, () => log.push(`${type} child`));
      }
      await userEvent.click(button!, { force: true, position: { x: 2, y: 2 } });
      const pointer = [
        'pointerdown capture',
        'pointerdown ancestor',
        'pointerup capture',
        'pointerup ancestor',
      ];
      expect(log.filter((entry) => entry.startsWith('pointer'))).toEqual(pointer);
      expect(log.filter((entry) => !entry.startsWith('pointer'))).toEqual(
        capture.map((type) => `${type} capture`),
      );
      expect(listeners.onPointerdown).toHaveBeenCalledOnce();
      expect(listeners.onPointerup).toHaveBeenCalledOnce();
      expect(listeners.onMousedown).not.toHaveBeenCalled();
      expect(listeners.onMouseup).not.toHaveBeenCalled();
      expect(listeners.onClick).not.toHaveBeenCalled();

      // A press on a child runs the listeners of the child.
      log.length = 0;
      await userEvent.click(child, { force: true });
      expect(log.filter((entry) => entry.endsWith('child'))).toEqual(
        events.map((type) => `${type} child`),
      );
      expect(
        log.filter((entry) => entry.endsWith('ancestor') && !entry.startsWith('pointer')),
      ).toEqual([]);
      expect(listeners.onClick).not.toHaveBeenCalled();
    },
  );

  test('focusableWhenDisabled changes nothing on an enabled button', async () => {
    const onClick = vi.fn();
    const { buttons } = mountButtons({ focusableWhenDisabled: true, onClick });
    await nextTick();
    const [button] = buttons;
    expect(button!.getAttributeNames()).toEqual([]);
    await userEvent.click(button!);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('an element that is not a native button', () => {
  test('gets the role button and a tab stop at the mount; a role and a tabindex of the developer win', async () => {
    const { element } = await mountInSlot('span');
    expect(element()).toHaveAttribute('role', 'button');
    expect(element()).toHaveAttribute('tabindex', '0');
    expect(element()).not.toHaveAttribute('type');
    expect(element()).not.toHaveAttribute('aria-disabled');
    const own = await mountInSlot('span', { role: 'switch', tabindex: -1 });
    expect(own.element()).toHaveAttribute('role', 'switch');
    expect(own.element()).toHaveAttribute('tabindex', '-1');
  });

  test('Enter and Space give one click each to a capture listener, the element and an ancestor', async () => {
    const onClick = vi.fn();
    const { ancestor, element } = await mountInSlot('span', { onClick });
    const log = recordClicks(ancestor, element());
    element().focus();
    await userEvent.keyboard('{Enter}');
    expect(log).toEqual(['capture', 'element', 'ancestor']);
    await userEvent.keyboard(' ');
    expect(log).toEqual(['capture', 'element', 'ancestor', 'capture', 'element', 'ancestor']);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  test('the click of a key has detail 0 and the modifier keys of the key press', async () => {
    const clicks: string[] = [];
    const { element } = await mountInSlot('span', {
      onClick: (event: MouseEvent) =>
        clicks.push(
          `${event.detail} ${['shiftKey', 'ctrlKey', 'altKey', 'metaKey'].filter((key) => event[key as 'shiftKey']).join(' ')}`,
        ),
    });
    element().focus();
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    await userEvent.keyboard('{Alt>} {/Alt}');
    await userEvent.keyboard('{Meta>} {/Meta}');
    expect(clicks).toEqual(['0 shiftKey', '0 ctrlKey', '0 altKey', '0 metaKey']);
  });

  test('Space does not scroll the page', async () => {
    const { element } = await mountInSlot('span');
    const prevented = recordSpaceKeydowns();
    element().focus();
    await userEvent.keyboard(' ');
    expect(prevented).toEqual([true]);
  });

  test('a key on a child of the element gives no click', async () => {
    const onClick = vi.fn();
    const { element } = await mountInSlot('span', { onClick });
    const child = element().querySelector<HTMLElement>('.Child')!;
    child.tabIndex = -1;
    child.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).not.toHaveBeenCalled();
  });

  test('preventDefault() in a keydown listener stops the click of Enter, and in a keyup listener the click of Space', async () => {
    const onClick = vi.fn();
    const { element } = await mountInSlot('span', {
      onClick,
      onKeydown: (event: KeyboardEvent) => event.key === 'Enter' && event.preventDefault(),
      onKeyup: (event: KeyboardEvent) => event.key === ' ' && event.preventDefault(),
    });
    element().focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).not.toHaveBeenCalled();
  });

  // A native button gives no click in these cases (test/measurements/button.test.ts).
  test('Space gives no click after a keydown that a listener prevents, or with no keydown on the element', async () => {
    const onClick = vi.fn();
    let prevents = false;
    const { element, form } = await mountInSlot('span', {
      onClick,
      onKeydown: (event: KeyboardEvent) => prevents && event.preventDefault(),
    });
    element().focus();
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledOnce();
    prevents = true;
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledOnce();
    prevents = false;

    const text = form.appendChild(document.createElement('input'));
    text.addEventListener('keydown', (event) => {
      if (event.key === ' ') {
        event.preventDefault();
        element().focus();
      }
    });
    text.focus();
    await userEvent.keyboard(' ');
    expect(element()).toHaveFocus();
    expect(onClick).toHaveBeenCalledOnce();
  });

  test('Space gives its click at its own keyup when another key goes up first', async () => {
    const log: string[] = [];
    const { element } = await mountInSlot('span', {
      onClick: () => log.push('click'),
      onKeyup: (event: KeyboardEvent) => log.push(event.key === ' ' ? 'keyup Space' : 'keyup'),
    });
    element().focus();
    await userEvent.keyboard('{ >}{Shift}{/ }');
    expect(log).toEqual(['keyup', 'keyup Space', 'click']);
  });

  test('a held Enter gives a click for each keydown, and a held Space one click at keyup', async () => {
    const onClick = vi.fn();
    const { element } = await mountInSlot('span', { onClick });
    element().focus();
    await userEvent.keyboard('{Enter>3/}');
    expect(onClick).toHaveBeenCalledTimes(3);
    await userEvent.keyboard('{ >3/}');
    expect(onClick).toHaveBeenCalledTimes(4);
  });

  test('a link with href gets the role, Space gives one click and the move, and Enter the one click of the browser', async () => {
    const onClick = vi.fn();
    const { element } = await mountInSlot('a', { href: '#button-target', onClick });
    const prevented = recordSpaceKeydowns();
    expect(element()).toHaveAttribute('role', 'button');
    element().focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(location.hash).toBe('#button-target'));
    expect(onClick).toHaveBeenCalledOnce();
    expect(prevented).toEqual([true]);
    history.replaceState(null, '', location.pathname + location.search);
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(location.hash).toBe('#button-target'));
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  test('a link with no href gets a click from Enter', async () => {
    const onClick = vi.fn();
    const { element } = await mountInSlot('a', { onClick });
    element().focus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });

  test('disabled: aria-disabled and tabindex -1, no disabled attribute, no click from a press, Enter or Space, and Space does not scroll', async () => {
    const onClick = vi.fn();
    const { ancestor, element } = await mountInSlot('span', { disabled: true, onClick });
    expect(element()).toHaveAttribute('aria-disabled', 'true');
    expect(element()).toHaveAttribute('tabindex', '-1');
    expect(element()).not.toHaveAttribute('disabled');
    const log = recordClicks(ancestor, element());
    const prevented = recordSpaceKeydowns();
    await userEvent.click(element(), { force: true });
    expect(log).toEqual(['capture']);
    // A click gives the element the focus, because it has a tabindex.
    expect(element()).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(log).toEqual(['capture']);
    expect(prevented).toEqual([true]);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('disabled with focusableWhenDisabled: tabindex 0; Enter and Space give no click, and Space does not scroll', async () => {
    const onClick = vi.fn();
    const { ancestor, element } = await mountInSlot('span', {
      disabled: true,
      focusableWhenDisabled: true,
      onClick,
    });
    expect(element()).toHaveAttribute('aria-disabled', 'true');
    expect(element()).toHaveAttribute('tabindex', '0');
    const log = recordClicks(ancestor, element());
    const prevented = recordSpaceKeydowns();
    element().focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(log).toEqual([]);
    expect(prevented).toEqual([true]);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('the attributes and listeners of the developer reach only the element of the slot, also inside another element', async () => {
    const onClick = vi.fn();
    const { element } = await mountInSlot('wrapped', { 'aria-label': 'Save', onClick });
    const inner = element().querySelector<HTMLElement>('[role=button]')!;
    expect(element()).not.toHaveAttribute('aria-label');
    expect(inner).toHaveAttribute('aria-label', 'Save');
    inner.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  test('a button component in the slot gets no role and no tabindex', async () => {
    const { element, exposed } = await mountInSlot('styled', { disabled: true });
    expect(element()).toHaveClass('StyledButton');
    expect(exposed.button.element).toBe(element());
    expect(element().getAttributeNames().sort()).toEqual(['class', 'disabled']);
  });

  test('follows a swap of the element in the slot', async () => {
    const { scene, element } = await mountInSlot('span', { disabled: true });
    expect(element()).toHaveAttribute('role', 'button');
    scene.tag = 'button';
    await waitFor(() => expect(element().localName).toBe('button'));
    await nextTick();
    expect(element().getAttributeNames()).toEqual(['disabled']);
    scene.tag = 'span';
    await waitFor(() => expect(element().localName).toBe('span'));
    await nextTick();
    expect(element().getAttributeNames().sort()).toEqual(['aria-disabled', 'role', 'tabindex']);
  });

  test('an input of the type submit in the slot gets no role and no tabindex, and Enter submits its form one time', async () => {
    const { element, form } = await mountInSlot('input');
    expect(element().getAttributeNames().sort()).toEqual(['type', 'value']);
    const submits = vi.fn();
    form.addEventListener('submit', submits);
    element().focus();
    await userEvent.keyboard('{Enter}');
    expect(submits).toHaveBeenCalledOnce();
  });
});

describe('the options of useButton', () => {
  test('type gives type="button" to a <button>, also in the server HTML, and no type to a <span>; a type of the developer wins', async () => {
    const serverRoot = await renderOnServer('ButtonParts');
    expect(serverRoot.querySelector('#button')).toHaveAttribute('type', 'button');
    const { root } = mount(ButtonParts);
    await nextTick();
    expect(root.querySelector('#button')).toHaveAttribute('type', 'button');
    expect(root.querySelector('#span')).not.toHaveAttribute('type');
    expect(root.querySelector('#submit')).toHaveAttribute('type', 'submit');
  });

  test('an attribute of the part wins over the button, and one of the developer wins over both; a listener of the part runs after the stop', async () => {
    const scene = reactive({ disabled: false, click: vi.fn() });
    const { root } = mount(ButtonParts, { scene });
    await nextTick();
    const grouped = root.querySelector<HTMLElement>('#grouped')!;
    expect(grouped).toHaveAttribute('tabindex', '-1');
    expect(root.querySelector('#developer')).toHaveAttribute('tabindex', '0');
    grouped.click();
    expect(scene.click).toHaveBeenCalledOnce();
    scene.disabled = true;
    await nextTick();
    grouped.click();
    expect(scene.click).toHaveBeenCalledOnce();
  });
});

describe.each(['fieldset', 'root'] as const)('VUE-112: a disabled fieldset (%s)', (kind) => {
  function mountFieldset(disabled: boolean, ownDisabled = false) {
    const scene = reactive({ kind, disabled, ownDisabled, click: vi.fn() });
    const { root } = mount(ButtonsInFieldset, { scene });
    const find = (name: string) => root.querySelector<HTMLElement>(`.${name}`)!;
    return { scene, find };
  }

  test('a native button has the state disabled, matches :disabled, and follows the fieldset', async () => {
    const { scene, find } = mountFieldset(false);
    await settle();
    expect(find('Native')).toHaveTextContent('Native false');
    scene.disabled = true;
    await waitFor(() => expect(find('Native')).toHaveTextContent('Native true'));
    expect(find('Native').matches(':disabled')).toBe(true);
    scene.disabled = false;
    await waitFor(() => expect(find('Native')).toHaveTextContent('Native false'));
    expect(find('Native').matches(':disabled')).toBe(false);
  });

  test('the disabled prop holds after the fieldset becomes enabled', async () => {
    const { scene, find } = mountFieldset(true, true);
    await settle();
    expect(find('Native')).toHaveTextContent('Native true');
    scene.disabled = false;
    await settle();
    expect(find('Native')).toHaveTextContent('Native true');
    expect(find('Native').matches(':disabled')).toBe(true);
  });

  test('a button in the first legend stays enabled', async () => {
    const { find } = mountFieldset(true);
    await settle();
    expect(find('InLegend')).toHaveTextContent('Legend false');
    expect(find('InLegend').matches(':disabled')).toBe(false);
  });

  test('an element that is not a native button stays enabled, and its click listener runs', async () => {
    const { scene, find } = mountFieldset(true);
    await settle();
    expect(find('Custom')).toHaveTextContent('Custom false');
    expect(find('Custom')).not.toHaveAttribute('aria-disabled');
    await userEvent.click(find('Custom'));
    expect(scene.click).toHaveBeenCalledOnce();
  });

  test('a button with focusableWhenDisabled does not stay in the tab order', async () => {
    const { find } = mountFieldset(true);
    await settle();
    expect(find('Focusable')).toHaveTextContent('Focusable true');
    find('InLegend').focus();
    await userEvent.keyboard('{Tab}');
    expect(find('Custom')).toHaveFocus();
  });
});

test('a disabled Fieldset.Root whose element is not a fieldset disables a native button', async () => {
  const scene = reactive({ kind: 'div', disabled: true, ownDisabled: false });
  const { root } = mount(ButtonsInFieldset, { scene });
  await settle();
  const native = root.querySelector('.Native')!;
  expect(native).toHaveTextContent('Native true');
  expect(native.matches(':disabled')).toBe(true);
});

describe('accessibility', () => {
  test.each([
    { name: 'a native button', tag: 'button', attrs: {} },
    { name: 'a disabled native button', tag: 'button', attrs: { disabled: true } },
    {
      name: 'a disabled native button that keeps the focus',
      tag: 'button',
      attrs: { disabled: true, focusableWhenDisabled: true },
    },
    { name: 'a disabled element that is not a button', tag: 'span', attrs: { disabled: true } },
  ] as const)('has no axe violation as $name', async ({ tag, attrs }) => {
    const { element } = await mountInSlot(tag, attrs);
    await expectNoAxeViolations(element());
  });
});
