import { describe, expect, inject, onTestFinished, test } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { Toolbar } from '@vase-ui/vue/toolbar';
import ToolbarParts from '../../test/fixtures/ToolbarParts.vue';
import ToolbarPartOutside from '../../test/fixtures/ToolbarPartOutside.vue';
import ToolbarElements from '../../test/fixtures/ToolbarElements.vue';
import type { ToolbarFixtureItem } from '../../test/fixtures/ToolbarItem.vue';
import { mount, mountError, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';

type Entry =
  | ToolbarFixtureItem
  | { key: string; group: ToolbarFixtureItem[]; attrs?: Record<string, unknown> };

async function mountToolbar(root: Record<string, unknown>, list: Entry[]) {
  const scene = { root: reactive(root), items: reactive(list) };
  const { root: app, exposed } = mount(ToolbarParts, scene);
  await settle();
  return {
    ...scene,
    app,
    exposed,
    element: app.querySelector<HTMLElement>('[role=toolbar]')!,
    item: <T extends HTMLElement = HTMLElement>(key: string) => app.querySelector<T>(`#${key}`)!,
    tabindexes: (...keys: string[]) =>
      keys.map((key) => app.querySelector(`#${key}`)!.getAttribute('tabindex')),
  };
}

const buttons = (...keys: string[]): ToolbarFixtureItem[] => keys.map((key) => ({ key }));
const focused = () => (document.activeElement as HTMLElement).id || 'none';

/** Presses each key, and gives the element with the focus after each one. */
async function press(...keys: string[]) {
  const steps: string[] = [];
  for (const key of keys) {
    await userEvent.keyboard(key);
    steps.push(focused());
  }
  return steps;
}

/** Listeners that write each event of `types` in `log`. */
function recordEvents(log: string[], name: string, types: string[]) {
  return Object.fromEntries(
    types.map((type) => [
      `on${type[0]!.toUpperCase()}${type.slice(1)}`,
      (event: Event) => {
        const { key } = event as KeyboardEvent;
        log.push(`${name} ${type}${key === undefined ? '' : ` ${key === ' ' ? 'Space' : key}`}`);
      },
    ]),
  );
}

test('the project compiles Toolbar and the fixtures in the modes of its app', () => {
  const app = inject('app');
  const isVapor = (component: object) => '__vapor' in component;
  expect(isVapor(Toolbar.Root)).toBe(app === 'vapor' || app === 'vdom-interop');
  expect(isVapor(ToolbarParts)).toBe(app.startsWith('vapor'));
});

describe('the elements', () => {
  test('the root is one div with role toolbar, aria-orientation and the attributes of the developer; a template ref has the element', async () => {
    const { element, exposed, app } = await mountToolbar(
      { 'aria-label': 'Format', class: 'Toolbar', orientation: 'vertical' },
      buttons('a'),
    );
    expect(element.localName).toBe('div');
    expect(element.getAttributeNames().sort()).toEqual([
      'aria-label',
      'aria-orientation',
      'class',
      'role',
    ]);
    expect(element).toHaveAttribute('aria-orientation', 'vertical');
    expect(exposed.root.element).toBe(element);
    expect(app.querySelector('.State')).toHaveTextContent('false vertical');
  });

  test('an attribute of the developer with the value undefined removes the attribute of the part', async () => {
    const { app } = await mountToolbar({ role: undefined, 'aria-orientation': undefined }, [
      { key: 'a', attrs: { type: undefined } },
    ]);
    const element = app.querySelector('.State')!.parentElement!;
    expect(element).not.toHaveAttribute('role');
    expect(element).not.toHaveAttribute('aria-orientation');
    expect(app.querySelector('#a')).not.toHaveAttribute('type');
  });

  test('a disabled root has data-disabled and no aria-disabled; a group has role group, data-orientation, and the disabled state of the toolbar', async () => {
    const { element, item, app } = await mountToolbar({ disabled: true }, [
      { key: 'g', group: buttons('a') },
    ]);
    expect(element).toHaveAttribute('data-disabled', '');
    expect(element).not.toHaveAttribute('aria-disabled');
    expect(item('g')).toHaveAttribute('role', 'group');
    expect(item('g')).toHaveAttribute('data-orientation', 'horizontal');
    expect(item('g')).toHaveAttribute('data-disabled', '');
    expect(item('g')).not.toHaveAttribute('aria-disabled');
    expect(app.querySelector('.GroupState')).toHaveTextContent('true horizontal');
  });

  test('a button is a <button type="button"> with data-orientation; a type of the developer wins', async () => {
    const { item } = await mountToolbar({}, [
      { key: 'a' },
      { key: 'b', attrs: { type: 'submit' } },
    ]);
    expect(item('a').localName).toBe('button');
    expect(item('a').getAttributeNames().sort()).toEqual([
      'data-orientation',
      'id',
      'tabindex',
      'type',
    ]);
    expect(item('a')).toHaveAttribute('type', 'button');
    expect(item('b')).toHaveAttribute('type', 'submit');
  });

  test('a link is an <a> with its href and data-orientation, and an input is the Input part with data-orientation', async () => {
    const { item } = await mountToolbar({ orientation: 'vertical' }, [
      { key: 'link', kind: 'link', attrs: { target: '_blank' } },
      { key: 'text', kind: 'input', attrs: { defaultValue: 'Text' } },
    ]);
    expect(item('link').localName).toBe('a');
    expect(item('link')).toHaveAttribute('href', '#link');
    expect(item('link')).toHaveAttribute('target', '_blank');
    expect(item('link')).toHaveAttribute('data-orientation', 'vertical');
    expect(item<HTMLInputElement>('text').localName).toBe('input');
    expect(item<HTMLInputElement>('text').value).toBe('Text');
    expect(item('text')).toHaveAttribute('data-orientation', 'vertical');
  });

  test('each part takes a tag in as, and the element slot with its state; a template ref has the element', async () => {
    const { root, exposed } = mount(ToolbarElements, { scene: reactive({ as: true }) });
    await settle();
    const find = (name: string) => root.querySelector<HTMLElement>(`.${name}`)!;
    expect(['Root', 'Group', 'Button', 'Link'].map((name) => find(name).localName)).toEqual([
      'section',
      'section',
      'span',
      'span',
    ]);
    expect(find('Button')).toHaveAttribute('role', 'button');
    expect(find('Button')).toHaveAttribute('tabindex', '0');
    expect(find('Link')).toHaveAttribute('tabindex', '-1');
    for (const name of ['root', 'group', 'button', 'link', 'input', 'separator']) {
      expect(exposed[name].element).toBe(find(name[0]!.toUpperCase() + name.slice(1)));
    }

    const slots = mount(ToolbarElements, { scene: reactive({ slots: true }) }).root;
    await settle();
    const state = (name: string) => slots.querySelector(`.${name}`)!.getAttribute('data-state');
    expect(state('Root')).toBe('{"disabled":true,"orientation":"vertical"}');
    expect(state('Group')).toBe('{"disabled":true,"orientation":"vertical"}');
    expect(state('Button')).toBe('{"disabled":true,"focusable":true,"orientation":"vertical"}');
    expect(state('Link')).toBe('{"orientation":"vertical"}');
    expect(state('Input')).toBe('{"disabled":true,"focusable":false,"orientation":"vertical"}');
    expect(state('Separator')).toBe('{"orientation":"horizontal"}');
    expect(slots.querySelector('.Root')).toHaveAttribute('role', 'toolbar');
    expect(slots.querySelector('.Input')).toHaveAttribute('disabled');
  });
});

describe('Toolbar.Separator', () => {
  test.each([
    { orientation: 'horizontal', across: 'vertical' },
    { orientation: 'vertical', across: 'horizontal' },
  ])(
    'is a separator across a $orientation toolbar, with the attributes of the developer; an orientation of the developer wins',
    async ({ orientation, across }) => {
      const { item } = await mountToolbar({ orientation }, [
        { key: 'a' },
        { key: 'across', kind: 'separator', attrs: { class: 'Line' } },
        { key: 'given', kind: 'separator', attrs: { orientation } },
      ]);
      expect(item('across')).toHaveAttribute('role', 'separator');
      expect(item('across')).toHaveAttribute('aria-orientation', across);
      expect(item('across')).toHaveClass('Line');
      expect(item('given')).toHaveAttribute('aria-orientation', orientation);
      expect(item('across')).not.toHaveAttribute('tabindex');
    },
  );
});

describe('Toolbar.Input', () => {
  test('gives v-model, name, id and the change event to its Input; a cancelled change keeps the text', async () => {
    const log: string[] = [];
    const attrs = reactive<Record<string, unknown>>({
      modelValue: 'a',
      name: 'query',
      onValueChange: (value: string, details: { cancel(): void }) => {
        log.push(`valueChange ${value}`);
        if (value === 'abc') details.cancel();
      },
      'onUpdate:modelValue': (value: string) => {
        log.push(`update ${value}`);
        attrs.modelValue = value;
      },
    });
    const { item } = await mountToolbar({}, [{ key: 'text', kind: 'input', attrs }]);
    const input = item<HTMLInputElement>('text');
    expect(input.name).toBe('query');
    expect(input.value).toBe('a');
    input.focus();
    input.setSelectionRange(1, 1);
    await userEvent.keyboard('bc');
    await settle();
    expect(log).toEqual(['valueChange ab', 'update ab', 'valueChange abc']);
    expect(input.value).toBe('ab');
    attrs.modelValue = 'x';
    await nextTick();
    expect(input.value).toBe('x');
  });

  test('with the element slot, gives id, name and readonly to the element in the slot', async () => {
    const { app } = await mountToolbar({}, [
      { key: 'box', kind: 'checkbox', attrs: { id: 'wrap', name: 'wrap', readonly: true } },
    ]);
    const box = app.querySelector<HTMLInputElement>('#wrap')!;
    expect(box.type).toBe('checkbox');
    expect(box.name).toBe('wrap');
    expect(box).toHaveAttribute('aria-readonly', 'true');
  });

  test('keeps the text of the user at a render with defaultValue', async () => {
    const { item, root } = await mountToolbar({}, [
      { key: 'text', kind: 'input', attrs: { defaultValue: 'a' } },
    ]);
    const input = item<HTMLInputElement>('text');
    input.focus();
    input.setSelectionRange(1, 1);
    await userEvent.keyboard('b');
    root.orientation = 'vertical';
    await nextTick();
    expect(input.value).toBe('ab');
  });
});

describe('the keys', () => {
  test.each([
    { dir: 'ltr', orientation: 'horizontal', next: '{ArrowRight}', previous: '{ArrowLeft}' },
    { dir: 'ltr', orientation: 'vertical', next: '{ArrowDown}', previous: '{ArrowUp}' },
    { dir: 'rtl', orientation: 'horizontal', next: '{ArrowLeft}', previous: '{ArrowRight}' },
    { dir: 'rtl', orientation: 'vertical', next: '{ArrowDown}', previous: '{ArrowUp}' },
  ])(
    '$dir, $orientation: move the focus over the items, in a group too, and loop',
    async ({ dir, orientation, next, previous }) => {
      const { item } = await mountToolbar({ dir, orientation }, [
        { key: 'a' },
        { key: 'link', kind: 'link' },
        { key: 'g', group: buttons('b', 'c') },
        { key: 'text', kind: 'input' },
      ]);
      item('before').focus();
      await userEvent.keyboard('{Tab}');
      expect(focused()).toBe('a');
      expect(await press(next, next, next, next, next, previous, previous)).toEqual([
        'link',
        'b',
        'c',
        'text',
        'a',
        'text',
        'c',
      ]);
    },
  );

  test.each([
    { orientation: 'horizontal', keys: ['{ArrowDown}', '{ArrowUp}', '{Home}', '{End}'] },
    { orientation: 'vertical', keys: ['{ArrowRight}', '{ArrowLeft}', '{Home}', '{End}'] },
  ])(
    '$orientation: the keys of the other axis, Home and End do nothing; a key with a modifier does nothing',
    async ({ orientation, keys }) => {
      const { item } = await mountToolbar({ orientation }, buttons('a', 'b', 'c'));
      item('b').focus();
      const next = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
      const modified = ['Shift', 'Control', 'Alt', 'Meta'].map(
        (modifier) => `{${modifier}>}{${next}}{/${modifier}}`,
      );
      expect(await press(...keys, ...modified)).toEqual(Array(8).fill('b'));
    },
  );

  test('with loopFocus false, the focus stops at the two ends, and the key reaches no listener of the item', async () => {
    const log: string[] = [];
    const listeners = recordEvents(log, 'item', ['keydown']);
    const { item } = await mountToolbar({ loopFocus: false }, [
      { key: 'a', attrs: listeners },
      { key: 'b', attrs: listeners },
    ]);
    item('a').focus();
    expect(await press('{ArrowLeft}', '{ArrowRight}', '{ArrowRight}')).toEqual(['a', 'b', 'b']);
    expect(log).toEqual([]);
  });

  test('the keys follow the order of the document: an item that mounts before the others, and a keyed list that moves an item', async () => {
    const { item, items } = await mountToolbar({}, buttons('b', 'c'));
    items.unshift({ key: 'a' });
    await settle();
    item('c').focus();
    expect(await press('{ArrowRight}', '{ArrowRight}')).toEqual(['a', 'b']);
    items.push(items.shift()!);
    await settle();
    expect(await press('{ArrowRight}', '{ArrowRight}')).toEqual(['c', 'a']);
  });

  test('a key tries each other item one time, also from a focused item that becomes disabled and leaves the sequence', async () => {
    const attrs = reactive<Record<string, unknown>>({});
    const { item } = await mountToolbar({}, [
      { key: 'span', kind: 'span', attrs },
      { key: 'b', attrs: { style: 'display: none' } },
      { key: 'c', attrs: { style: 'display: none' } },
    ]);
    item('span').focus();
    Object.assign(attrs, { disabled: true, focusableWhenDisabled: false });
    await nextTick();
    expect(await press('{ArrowRight}', '{ArrowLeft}')).toEqual(['span', 'span']);
  });

  test('the keys pass an item that CSS hides, and an item with the disabled attribute in the element slot', async () => {
    const { item } = await mountToolbar({}, [
      { key: 'a' },
      { key: 'b', attrs: { style: 'display: none' } },
      { key: 'c', kind: 'disabled-button' },
      { key: 'd' },
    ]);
    item('a').focus();
    expect(await press('{ArrowRight}', '{ArrowLeft}')).toEqual(['d', 'a']);
  });
});

describe('a text input', () => {
  async function mountInputs(root: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
    // An arrow key moves the caret in the order that the eye reads, so the text of a right-to-left
    // input is Hebrew.
    const defaultValue = root.dir === 'rtl' && attrs.dir !== 'ltr' ? 'אבג' : 'abc';
    return mountToolbar(root, [
      { key: 'a' },
      { key: 'text', kind: 'input', attrs: { defaultValue, ...attrs } },
      { key: 'b' },
    ]);
  }

  test.each([
    { dir: 'ltr', toEnd: '{ArrowRight}', toStart: '{ArrowLeft}' },
    { dir: 'rtl', toEnd: '{ArrowLeft}', toStart: '{ArrowRight}' },
  ])(
    '$dir: keeps an arrow key while its caret is not at the edge of the key or it has a selection',
    async ({ dir, toEnd, toStart }) => {
      const { item } = await mountInputs({ dir });
      const input = item<HTMLInputElement>('text');
      input.focus();
      input.setSelectionRange(2, 2);
      expect(await press(toEnd)).toEqual(['text']);
      expect(input.selectionStart).toBe(3);
      input.setSelectionRange(0, 3);
      expect(await press(toEnd)).toEqual(['text']);
      expect(await press(toEnd)).toEqual(['b']);
      input.focus();
      input.setSelectionRange(0, 0);
      expect(await press(toStart)).toEqual(['a']);
    },
  );

  test('a key moves the focus to an input and selects its text; the next press removes the selection, and the press after it leaves', async () => {
    const { item } = await mountInputs({});
    const input = item<HTMLInputElement>('text');
    item('a').focus();
    expect(await press('{ArrowRight}')).toEqual(['text']);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 3]);
    expect(await press('{ArrowRight}', '{ArrowRight}')).toEqual(['text', 'b']);
  });

  test('in a vertical toolbar, a key moves the focus to an input and selects its text; the caret keys stay in it', async () => {
    const { item } = await mountInputs({ orientation: 'vertical' });
    const input = item<HTMLInputElement>('text');
    item('a').focus();
    expect(await press('{ArrowDown}')).toEqual(['text']);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 3]);
    expect(await press('{ArrowRight}', '{ArrowDown}', '{ArrowUp}')).toEqual(['text', 'b', 'text']);
    input.setSelectionRange(1, 1);
    expect(await press('{ArrowLeft}', '{ArrowUp}')).toEqual(['text', 'a']);
  });

  test.each([
    { orientation: 'horizontal', next: '{ArrowRight}', previous: '{ArrowLeft}' },
    { orientation: 'vertical', next: '{ArrowDown}', previous: '{ArrowUp}' },
  ])(
    '$orientation: Tab leaves a disabled input and Shift+Tab comes back to it; the keys pass it',
    async ({ orientation, next, previous }) => {
      const { item } = await mountInputs({ orientation }, { disabled: true });
      item('a').focus();
      expect(await press(next, '{Tab}', '{Shift>}{Tab}{/Shift}')).toEqual([
        'text',
        'after',
        'text',
      ]);
      expect(await press(next, previous, previous)).toEqual(['b', 'text', 'a']);
    },
  );

  test('an input keeps no key of the vertical axis, and a textarea keeps them while its caret is not at the edge', async () => {
    const { item } = await mountToolbar({ orientation: 'vertical' }, [
      { key: 'a' },
      { key: 'text', kind: 'input', attrs: { defaultValue: 'abc' } },
      { key: 'area', kind: 'textarea' },
      { key: 'b' },
    ]);
    const input = item<HTMLInputElement>('text');
    input.focus();
    input.setSelectionRange(1, 1);
    expect(await press('{ArrowDown}')).toEqual(['area']);
    const area = item<HTMLTextAreaElement>('area');
    area.value = 'one\ntwo';
    area.setSelectionRange(0, 0);
    expect(await press('{ArrowDown}', '{ArrowDown}', '{ArrowDown}')).toEqual(['area', 'area', 'b']);
    area.focus();
    area.setSelectionRange(4, 4);
    expect(await press('{ArrowUp}', '{ArrowUp}')).toEqual(['area', 'text']);
  });

  test('a disabled input keeps no key, and is read-only; readonly of the developer makes an enabled input read-only', async () => {
    const { item } = await mountInputs({}, { disabled: true });
    const input = item<HTMLInputElement>('text');
    input.focus();
    input.setSelectionRange(1, 1);
    expect(await press('{ArrowRight}')).toEqual(['b']);
    const readonly = await mountInputs({}, { readonly: true });
    expect(readonly.item('text')).toHaveAttribute('readonly');
    expect(readonly.item('text')).not.toHaveAttribute('aria-disabled');
  });

  test('a key with isComposing, or with the key code 229 that WebKit sends while a text input method composes, does not move the focus', async () => {
    const { item } = await mountInputs({});
    const input = item<HTMLInputElement>('text');
    input.focus();
    input.setSelectionRange(3, 3);
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    // The init dictionary has no key code, so the case gives the key code of WebKit to the event.
    Object.defineProperty(event, 'keyCode', { value: 229 });
    input.dispatchEvent(event);
    const composing = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(composing);
    expect(focused()).toBe('text');
    expect([event.defaultPrevented, composing.defaultPrevented]).toEqual([false, false]);
  });

  test('an input of the type email keeps no key, and an input with dir="ltr" in a right-to-left toolbar gives ArrowLeft to the toolbar at its start', async () => {
    const email = await mountInputs({}, { type: 'email' });
    email.item('text').focus();
    expect(await press('{ArrowLeft}')).toEqual(['a']);

    const { item } = await mountInputs({ dir: 'rtl' }, { dir: 'ltr' });
    const input = item<HTMLInputElement>('text');
    input.focus();
    input.setSelectionRange(0, 0);
    expect(await press('{ArrowLeft}')).toEqual(['b']);
  });

  // Playwright starts a composition only in Chromium.
  test.runIf(server.browser === 'chromium')(
    'keeps the arrow keys while a text input method composes',
    async () => {
      const { item } = await mountInputs({}, { defaultValue: '' });
      item('text').focus();
      await cdp().send('Input.imeSetComposition', {
        text: 'か',
        selectionStart: 1,
        selectionEnd: 1,
      });
      await cdp().send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        key: 'ArrowRight',
        code: 'ArrowRight',
        windowsVirtualKeyCode: 229,
      });
      expect(focused()).toBe('text');
      await cdp().send('Input.insertText', { text: 'か' });
    },
  );
});

describe('the tab stop', () => {
  test('after the mount, the first item has tabindex 0 and each other item -1; Tab and Shift+Tab reach the toolbar at it', async () => {
    const { item, tabindexes } = await mountToolbar({}, [
      { key: 'a' },
      { key: 'link', kind: 'link' },
      { key: 'text', kind: 'input' },
    ]);
    expect(tabindexes('a', 'link', 'text')).toEqual(['0', '-1', '-1']);
    item('before').focus();
    expect(await press('{Tab}', '{Tab}')).toEqual(['a', 'after']);
    expect(await press('{Shift>}{Tab}{/Shift}')).toEqual(['a']);
  });

  test('is the item that had the focus last', async () => {
    const { item, tabindexes } = await mountToolbar({}, [
      { key: 'a' },
      { key: 'link', kind: 'link' },
    ]);
    item('a').focus();
    await userEvent.keyboard('{ArrowRight}');
    item('after').focus();
    expect(tabindexes('a', 'link')).toEqual(['-1', '0']);
    expect(await press('{Shift>}{Tab}{/Shift}')).toEqual(['link']);
  });

  test('passes a disabled item that cannot take the focus, and moves off an item that becomes one; it stays on an item that keeps the focus', async () => {
    const off = { disabled: true, focusableWhenDisabled: false };
    const { items, tabindexes } = await mountToolbar({}, [
      { key: 'a', attrs: off },
      { key: 'b', kind: 'span', attrs: {} },
      { key: 'c' },
    ]);
    expect(tabindexes('a', 'b', 'c')).toEqual(['-1', '0', '-1']);
    Object.assign(items[1]!.attrs!, off);
    await nextTick();
    expect(tabindexes('a', 'b', 'c')).toEqual(['-1', '-1', '0']);
    items.unshift({ key: 'text', kind: 'input', attrs: off });
    await settle();
    expect(tabindexes('text', 'c')).toEqual(['-1', '0']);
    Object.assign(items[3]!.attrs ?? (items[3]!.attrs = {}), { disabled: true });
    await nextTick();
    expect(tabindexes('a', 'b', 'c')).toEqual(['-1', '-1', '0']);
  });

  test('goes to the first item when Vue removes the item that has the focus; Shift+Tab reaches the toolbar again', async () => {
    const { item, items, tabindexes } = await mountToolbar({}, buttons('a', 'b', 'c'));
    item('a').focus();
    await userEvent.keyboard('{ArrowRight}');
    items.splice(1, 1);
    await nextTick();
    expect(tabindexes('a', 'c')).toEqual(['0', '-1']);
    item('after').focus();
    expect(await press('{Shift>}{Tab}{/Shift}')).toEqual(['a']);
  });

  test('a tabindex of the developer on a part wins', async () => {
    const { tabindexes } = await mountToolbar({}, [
      { key: 'a' },
      { key: 'b', attrs: { tabindex: 0 } },
      { key: 'span', kind: 'span', attrs: { tabindex: 0 } },
    ]);
    expect(tabindexes('a', 'b', 'span')).toEqual(['0', '0', '0']);
  });
});

describe('disabled items', () => {
  test('a disabled toolbar disables each button and input, and no link; they keep the focus with aria-disabled and no disabled', async () => {
    const { item } = await mountToolbar({ disabled: true }, [
      { key: 'a' },
      { key: 'link', kind: 'link' },
      { key: 'g', group: [{ key: 'b' }, { key: 'text', kind: 'input' }] },
    ]);
    for (const key of ['a', 'b', 'text']) {
      expect(item(key)).toHaveAttribute('aria-disabled', 'true');
      expect(item(key)).not.toHaveAttribute('disabled');
    }
    expect(item('text')).toHaveAttribute('readonly');
    expect(item('link')).not.toHaveAttribute('aria-disabled');
    item('before').focus();
    expect(await press('{Tab}', '{ArrowRight}', '{ArrowRight}', '{ArrowRight}')).toEqual([
      'a',
      'link',
      'b',
      'text',
    ]);
  });

  test('a disabled group disables its items; with focusableWhenDisabled false, an item has disabled, and the keys pass it', async () => {
    const off = { disabled: true, focusableWhenDisabled: false };
    const { item } = await mountToolbar({}, [
      { key: 'a', attrs: off },
      { key: 'g', group: [{ key: 'b' }, { key: 'link', kind: 'link' }], attrs: { disabled: true } },
      { key: 'text', kind: 'input', attrs: off },
      { key: 'c' },
    ]);
    expect(item('a')).toHaveAttribute('disabled');
    expect(item('text')).toHaveAttribute('disabled');
    expect(item('text')).not.toHaveAttribute('readonly');
    expect(item('b')).toHaveAttribute('aria-disabled', 'true');
    expect(item('link')).not.toHaveAttribute('aria-disabled');
    item('b').focus();
    expect(await press('{ArrowRight}', '{ArrowRight}', '{ArrowRight}')).toEqual(['link', 'c', 'b']);
  });

  test.each([
    { name: 'a native button', item: { key: 'item' } },
    { name: 'a span in the slot', item: { key: 'item', kind: 'span' as const } },
    { name: 'a text input', item: { key: 'item', kind: 'input' as const } },
  ])(
    '$name: no listener gets a press or a key, and the browser does nothing; capture listeners get them, and hover events pass',
    async ({ item: entry }) => {
      const log: string[] = [];
      const types = ['click', 'mousedown', 'pointerdown', 'keydown', 'keyup', 'pointerenter'];
      const { item } = await mountToolbar({}, [
        { key: 'a' },
        { ...entry, attrs: { disabled: true, ...recordEvents(log, 'item', types) } },
      ]);
      const target = item('item');
      const capture = (event: Event) => log.push(`capture ${event.type}`);
      const bubble = (event: Event) => log.push(`document ${event.type}`);
      for (const type of ['click', 'keydown']) {
        document.addEventListener(type, capture, true);
        document.addEventListener(type, bubble);
      }
      try {
        item('a').focus();
        await userEvent.click(target, { force: true });
        expect(focused()).toBe('a');
        expect(await press('{ArrowRight}')).toEqual(['item']);
        await userEvent.keyboard('{Enter} x');
        await userEvent.click(target, { force: true });
        expect(log).toEqual([
          'item pointerenter',
          'capture click',
          'capture keydown',
          'capture keydown',
          'capture keydown',
          'capture keydown',
          'capture click',
        ]);
        if (target instanceof HTMLInputElement) expect(target.value).toBe('');
      } finally {
        for (const type of ['click', 'keydown']) {
          document.removeEventListener(type, capture, true);
          document.removeEventListener(type, bubble);
        }
      }
    },
  );

  test('an enabled item with focusableWhenDisabled false takes the focus from the keys', async () => {
    const { item } = await mountToolbar({}, [
      { key: 'a' },
      { key: 'b', attrs: { focusableWhenDisabled: false } },
      { key: 'c' },
    ]);
    expect(item('b')).not.toHaveAttribute('disabled');
    item('a').focus();
    expect(await press('{ArrowRight}', '{ArrowRight}')).toEqual(['b', 'c']);
  });

  test('a disabled input and a disabled checkbox take a click again when they become enabled', async () => {
    const text = reactive({ disabled: true });
    const box = reactive({ disabled: true });
    const { item } = await mountToolbar({}, [
      { key: 'a' },
      { key: 'text', kind: 'input', attrs: text },
      { key: 'box', kind: 'checkbox', attrs: box },
    ]);
    item('a').focus();
    await userEvent.click(item('text'), { force: true });
    expect(focused()).toBe('a');
    await userEvent.click(item('box'), { force: true });
    expect(item<HTMLInputElement>('box').checked).toBe(false);
    text.disabled = false;
    box.disabled = false;
    await nextTick();
    await userEvent.click(item('text'));
    expect(focused()).toBe('text');
    await userEvent.click(item('box'));
    expect(item<HTMLInputElement>('box').checked).toBe(true);
  });

  test('a press that a capture listener stops before it reaches a disabled item leaves no stop on the item', async () => {
    const log: string[] = [];
    let stops = 1;
    const group = {
      onClickCapture: (event: Event) => {
        if (stops-- > 0) event.stopPropagation();
      },
    };
    const attrs = reactive({ disabled: true, ...recordEvents(log, 'item', ['click']) });
    const { item } = await mountToolbar({}, [
      { key: 'g', group: [{ key: 'b', attrs }], attrs: group },
    ]);
    await userEvent.click(item('b'), { force: true });
    attrs.disabled = false;
    await nextTick();
    await userEvent.click(item('b'));
    expect(log).toEqual(['item click']);
  });

  test('Escape, F1, Tab and a key with Ctrl, Alt or Meta reach the listeners of a disabled item', async () => {
    const log: string[] = [];
    const { item } = await mountToolbar({}, [
      { key: 'a', attrs: { disabled: true, ...recordEvents(log, 'item', ['keydown']) } },
    ]);
    item('a').focus();
    await userEvent.keyboard('{Escape}{F1}{Control>}c{/Control}{Alt>}c{/Alt}{Meta>}c{/Meta}{Tab}');
    expect(log).toEqual([
      'item keydown Escape',
      'item keydown F1',
      'item keydown Control',
      'item keydown c',
      'item keydown Alt',
      'item keydown c',
      'item keydown Meta',
      'item keydown c',
      'item keydown Tab',
    ]);
  });

  test('a click and Space do not check a disabled checkbox in the slot of Toolbar.Input, which keeps the focus', async () => {
    const { item } = await mountToolbar({}, [
      { key: 'a' },
      { key: 'box', kind: 'checkbox', attrs: { disabled: true } },
    ]);
    const box = item<HTMLInputElement>('box');
    expect(box).toHaveAttribute('aria-disabled', 'true');
    expect(box).toHaveAttribute('aria-readonly', 'true');
    await userEvent.click(box, { force: true });
    item('a').focus();
    await userEvent.keyboard('{ArrowRight} ');
    expect(focused()).toBe('box');
    expect(box.checked).toBe(false);
  });
});

describe('Toolbar.Button with an element that is not a button', () => {
  test('a span in the slot has the role button, and Enter and Space each give one click', async () => {
    const log: string[] = [];
    const { item } = await mountToolbar({}, [
      { key: 'span', kind: 'span', attrs: recordEvents(log, 'span', ['click']) },
    ]);
    const capture = () => log.push('document capture click');
    const bubble = () => log.push('document click');
    document.addEventListener('click', capture, true);
    document.addEventListener('click', bubble);
    onTestFinished(() => {
      document.removeEventListener('click', capture, true);
      document.removeEventListener('click', bubble);
    });
    expect(item('span')).toHaveAttribute('role', 'button');
    item('span').focus();
    await userEvent.keyboard('{Enter} ');
    expect(log).toEqual([
      'document capture click',
      'span click',
      'document click',
      'document capture click',
      'span click',
      'document click',
    ]);
  });
});

// A part that throws in its setup is the last case of the file: Vue then keeps a broken state.
test.each(['group', 'button', 'input', 'link', 'separator'])(
  'a part outside Toolbar.Root throws an error that says so (%s)',
  (part) => {
    expect((mountError(ToolbarPartOutside, { part }) as Error).message).toBe(
      'Vase UI: A part of Toolbar must be inside <Toolbar.Root>. Without a root the part has no orientation and no disabled state. Put the part inside <Toolbar.Root>.',
    );
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  },
);
