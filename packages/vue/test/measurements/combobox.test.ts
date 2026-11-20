// Measurements for Combobox and Autocomplete, with native elements and plain Vue, and no code of the
// library, but where a case names a part. Each one states what the browser or Vue does, so that
// the parts have code only where they do not do it. Vue does not patch an element that leaves in a
// `<Transition>` (C5): see `tabs.test.ts`.
import { afterEach, describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import {
  createApp,
  computed,
  defineComponent,
  h,
  inject,
  nextTick,
  provide,
  shallowRef,
} from 'vue';
import ComboboxParts from '../fixtures/ComboboxParts.vue';
import { touchDrag } from '../pointer';
import { mount } from '../render';
import { waitFor } from '../waitFor';

let root: HTMLElement | undefined;

afterEach(() => {
  root?.remove();
  root = undefined;
});

function html(markup: string) {
  root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = markup;
  return root;
}

function element<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

function centerOf(target: Element) {
  const rect = target.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

const activeId = () => document.activeElement?.id || document.activeElement?.localName;

describe('a press in a popup while a text input has the focus (C1)', () => {
  test.each(['none', 'mousedown'])(
    'with preventDefault() at %s: the input keeps the focus only when `mousedown` is prevented',
    async (prevented) => {
      html(`<input id="input" aria-label="Input"><div id="item" style="height: 40px">Item</div>`);
      if (prevented === 'mousedown') {
        element('item').addEventListener('mousedown', (event) => event.preventDefault());
      }
      element('input').focus();
      await userEvent.click(element('item'));
      expect(activeId()).toBe(prevented === 'mousedown' ? 'input' : 'body');
    },
  );

  test.skipIf(server.browser !== 'chromium')(
    'a touch sends `mousedown` after its end, and preventDefault() there keeps the focus',
    async () => {
      html(`<input id="input" aria-label="Input"><div id="item" style="height: 40px">Item</div>`);
      element('item').addEventListener('mousedown', (event) => event.preventDefault());
      element('input').focus();
      const point = centerOf(element('item'));
      await touchDrag(point, point, 0);
      expect(activeId()).toBe('input');
    },
  );
});

describe('a list that scrolls under a pointer at rest (C2, C7)', () => {
  test('the item under the pointer gets `pointerover` at the point of the rest; WebKit also sends `pointermove` there', async () => {
    html(
      `<div id="box" style="position: fixed; left: 0; top: 0; width: 200px; height: 100px; overflow: auto">${Array.from(
        { length: 20 },
        (_, index) => `<div id="item${index}" style="height: 30px">Item ${index}</div>`,
      ).join('')}</div>`,
    );
    await userEvent.pointer({ coords: { x: 60, y: 25 } });
    const log: string[] = [];
    for (const type of ['pointerover', 'pointermove']) {
      element('box').addEventListener(type, (event) => {
        const { clientX, clientY } = event as PointerEvent;
        log.push(`${type} ${(event.target as Element).id} ${clientX},${clientY}`);
      });
    }
    element('box').scrollTop = 60;
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(log[0]).toBe('pointerover item2 60,25');
    expect(log.some((entry) => entry.startsWith('pointermove'))).toBe(server.browser === 'webkit');
  });
});

describe('content that comes under a pointer at rest (C2, C7)', () => {
  test('a browser can send `pointerover` at the point of the rest, and sends no `pointermove`', async () => {
    await userEvent.pointer({ coords: { x: 60, y: 25 } });
    const log: string[] = [];
    const listen = new AbortController();
    for (const type of ['pointerover', 'pointermove']) {
      document.addEventListener(
        type,
        (event) => {
          const { clientX, clientY } = event as PointerEvent;
          log.push(`${type} ${(event.target as Element).id} ${clientX},${clientY}`);
        },
        { signal: listen.signal },
      );
    }
    html(
      `<div id="box" style="position: fixed; left: 0; top: 0; width: 200px; height: 100px">${Array.from(
        { length: 3 },
        (_, index) => `<div id="item${index}" style="height: 30px">Item ${index}</div>`,
      ).join('')}</div>`,
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    listen.abort();
    expect(log.every((entry) => entry === 'pointerover item0 60,25')).toBe(true);
  });

  test('a move in one step sends `pointerover` and `pointermove` at one position', async () => {
    html(
      `<div id="box" style="position: fixed; left: 0; top: 0; width: 200px; height: 100px">Box</div>`,
    );
    await userEvent.pointer({ coords: { x: 300, y: 300 } });
    const log: string[] = [];
    for (const type of ['pointerover', 'pointermove']) {
      element('box').addEventListener(type, (event) => {
        const { clientX, clientY } = event as PointerEvent;
        log.push(`${type} ${clientX},${clientY}`);
      });
    }
    await userEvent.pointer({ coords: { x: 60, y: 25 } });
    expect(log).toEqual(['pointerover 60,25', 'pointermove 60,25']);
  });
});

describe('Home and End in a text input (C3, N7)', () => {
  test('Chromium moves the caret; Firefox and WebKit move it only off macOS', async () => {
    html(`<input id="input" aria-label="Input" value="hello world">`);
    const input = element<HTMLInputElement>('input');
    input.focus();
    input.setSelectionRange(5, 5);
    await userEvent.keyboard('{End}');
    const moves = server.browser === 'chromium' || server.platform !== 'darwin';
    expect(input.selectionStart).toBe(moves ? 11 : 5);
  });
});

describe('the `inputType` of an `input` event (C4)', () => {
  test('a key gives `insertText`; an event of a script has none', async () => {
    html(`<input id="input" aria-label="Input">`);
    const types: unknown[] = [];
    element('input').addEventListener('input', (event) =>
      types.push((event as InputEvent).inputType),
    );
    element('input').focus();
    await userEvent.keyboard('a{Backspace}');
    element('input').dispatchEvent(new Event('input', { bubbles: true }));
    expect(types).toEqual(['insertText', 'deleteContentBackward', undefined]);
  });
});

describe('the renders of 300 items for 20 steps of a highlight (C6)', () => {
  test.each([
    { form: 'a computed Boolean in each item', renders: 39 },
    { form: 'each item reads an object that each step makes again', renders: 6000 },
  ])('$form: $renders renders', async ({ form, renders }) => {
    let count = 0;
    const highlighted = shallowRef(-1);
    const shared = computed(() => ({ highlighted: highlighted.value }));
    const Item = defineComponent({
      props: { index: { type: Number, required: true } },
      setup(props) {
        const on = computed(() => highlighted.value === props.index);
        const state = inject<typeof shared>('shared')!;
        return () => {
          count += 1;
          const value = form.startsWith('a computed')
            ? on.value
            : state.value.highlighted === props.index;
          return h('div', { 'data-highlighted': value ? '' : undefined });
        };
      },
    });
    const app = createApp({
      setup() {
        provide('shared', shared);
        return () => Array.from({ length: 300 }, (_, index) => h(Item, { key: index, index }));
      },
    });
    root = document.body.appendChild(document.createElement('div'));
    app.mount(root);
    count = 0;
    for (let step = 0; step < 20; step += 1) {
      highlighted.value = step;
      await nextTick();
    }
    app.unmount();
    expect(count).toBe(renders);
  });
});

describe('scrollIntoView of an item (C8)', () => {
  test('scrolls the box and the page', () => {
    html(
      `<div style="height: 200vh"><div id="box" style="position: absolute; top: calc(100vh - 50px); height: 100px; overflow: auto">${Array.from(
        { length: 10 },
        (_, index) => `<div id="item${index}" style="height: 30px">Item ${index}</div>`,
      ).join('')}</div></div>`,
    );
    element('item3').scrollIntoView({ block: 'nearest' });
    expect(element('box').scrollTop).toBeGreaterThan(0);
    expect(window.scrollY).toBeGreaterThan(0);
    window.scrollTo(0, 0);
  });
});

describe('a press on a `<label for>` of a button (C9, N8)', () => {
  test('clicks the button, and gives it the focus but in WebKit on macOS', async () => {
    html(`<label id="label" for="button">Label</label><button id="button">Button</button>`);
    const log: string[] = [];
    element('button').addEventListener('click', () => log.push('click'));
    await userEvent.click(element('label'));
    expect(log).toEqual(['click']);
    const focuses = server.browser !== 'webkit' || server.platform !== 'darwin';
    expect(activeId()).toBe(focuses ? 'button' : 'body');
  });
});

describe('Enter after a microtask of `keydown` changed the values of a form (C10)', () => {
  test('Firefox submits the old values; Chromium and WebKit the new ones', async () => {
    html(
      `<form id="form"><input id="input" name="q" aria-label="Q" value="typed"><input id="hidden" type="hidden" name="h" value="old"></form>`,
    );
    let submitted: string[] = [];
    element('form').addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = [...new FormData(element<HTMLFormElement>('form')).values()] as string[];
    });
    element('input').addEventListener('keydown', () =>
      queueMicrotask(() => {
        element<HTMLInputElement>('input').value = 'label';
        element<HTMLInputElement>('hidden').value = 'new';
      }),
    );
    element('input').focus();
    await userEvent.keyboard('{Enter}');
    expect(submitted).toEqual(server.browser === 'firefox' ? ['typed', 'old'] : ['label', 'new']);
  });
});

describe('a submit that a required, hidden input blocks (C11)', () => {
  test('the input gets `invalid` and then the focus', async () => {
    html(
      `<form id="form"><input id="hidden" required tabindex="-1" aria-label="Hidden" style="position: absolute; width: 1px; height: 1px; clip-path: inset(50%)"><button id="submit">Submit</button></form>`,
    );
    const log: string[] = [];
    element('hidden').addEventListener('invalid', () => log.push('invalid'));
    element('hidden').addEventListener('focus', () => log.push('focus'));
    await userEvent.click(element('submit'));
    expect(log).toEqual(['invalid', 'focus']);
  });
});

describe('a text composition (C12, N6)', () => {
  test.skipIf(server.browser !== 'chromium')(
    'Chromium sends no `input` after `compositionend`',
    async () => {
      html(`<input id="input" aria-label="Input">`);
      const log: string[] = [];
      for (const type of ['compositionstart', 'compositionend', 'input']) {
        element('input').addEventListener(type, () => log.push(type));
      }
      element('input').focus();
      const { cdp } = await import('vitest/browser');
      const session = cdp();
      await session.send('Input.imeSetComposition', {
        text: 'に',
        selectionStart: 1,
        selectionEnd: 1,
      });
      await session.send('Input.insertText', { text: '日本' });
      expect(log).toEqual(['compositionstart', 'input', 'input', 'compositionend']);
    },
  );

  test('the input part writes one text and gives one highlight for a composition in the order of WebKit: its last `input` after `compositionend`', async () => {
    const texts: string[] = [];
    const highlights: unknown[] = [];
    mount(ComboboxParts, {
      root: {
        defaultOpen: true,
        autoHighlight: true,
        'onUpdate:inputValue': (text: string) => texts.push(text),
        onItemHighlighted: (value: unknown) => highlights.push(value),
      },
    });
    await nextTick();
    const input = document.querySelector<HTMLInputElement>('[data-testid="input"]')!;
    input.focus();
    const send = (event: Event) => input.dispatchEvent(event);
    send(new CompositionEvent('compositionstart', { data: '' }));
    input.value = 'a';
    send(
      new InputEvent('input', { inputType: 'insertCompositionText', data: 'a', isComposing: true }),
    );
    input.value = 'ap';
    send(new CompositionEvent('compositionend', { data: 'ap' }));
    // The browser runs the microtasks between two events that it sends in one task. The highlight
    // and its event come in two renders.
    await nextTick();
    await nextTick();
    expect(highlights).toEqual(['Apple']);
    send(new InputEvent('input', { inputType: 'insertFromComposition', data: 'ap' }));
    await nextTick();
    await nextTick();
    expect(texts).toEqual(['ap']);
    expect(highlights).toEqual(['Apple']);
  });
});

describe('the caret after setSelectionRange in each direction (C13)', () => {
  test.each(['ltr', 'rtl'])('%s: a character goes at the index of the caret', async (dir) => {
    html(`<input id="input" dir="${dir}" aria-label="Input" value="abc">`);
    const input = element<HTMLInputElement>('input');
    input.focus();
    input.setSelectionRange(0, 0);
    await userEvent.keyboard('x');
    expect(input.value).toBe('xabc');
    input.setSelectionRange(4, 4);
    await userEvent.keyboard('y');
    expect(input.value).toBe('xabcy');
  });
});

describe('the scroll of a text input after a script moved the caret (C14)', () => {
  test('Firefox scrolls to the caret; Chromium and WebKit do not', async () => {
    html(
      `<input id="input" aria-label="Input" style="width: 60px" value="${'a long text '.repeat(8)}">`,
    );
    const input = element<HTMLInputElement>('input');
    input.focus();
    input.setSelectionRange(0, 0);
    input.scrollLeft = 0;
    input.setSelectionRange(input.value.length, input.value.length);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(input.scrollLeft > 0).toBe(server.browser === 'firefox');
  });
});

describe('a kept popup that closes (N1)', () => {
  test('an element with `hidden` and an exit of `display` stays shown while the exit runs, but in Firefox', async () => {
    html(
      `<style>#kept { transition: opacity 300ms, display 300ms allow-discrete } #kept[hidden] { opacity: 0 }</style><div id="kept">Content</div>`,
    );
    await new Promise((resolve) => requestAnimationFrame(resolve));
    element('kept').hidden = true;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(element('kept').checkVisibility()).toBe(server.browser !== 'firefox');
  });
});

describe('a press on the scrollbar of a list whose `mousedown` is prevented (N3)', () => {
  test('scrolls the list, on a system whose scrollbar has a width', async ({ skip }) => {
    html(
      `<input id="input" aria-label="Input"><div id="box" style="width: 200px; height: 100px; overflow-y: scroll">${Array.from(
        { length: 20 },
        (_, index) => `<div style="height: 30px">Item ${index}</div>`,
      ).join('')}</div>`,
    );
    const box = element('box');
    box.addEventListener('mousedown', (event) => event.preventDefault());
    element('input').focus();
    const rect = box.getBoundingClientRect();
    const scrollbar = rect.width - box.clientWidth;
    if (scrollbar === 0) skip();
    await userEvent.pointer({
      coords: { x: rect.right - scrollbar / 2, y: rect.bottom - 20 },
      keys: '[MouseLeft]',
    });
    await waitFor(() => expect(box.scrollTop).toBeGreaterThan(0));
    expect(activeId()).toBe('input');
  });
});

describe('a mouse press on a trigger whose popup opens under the pointer (N4)', () => {
  test('the release at the point of the press selects nothing', async () => {
    const values: unknown[] = [];
    mount(ComboboxParts, {
      inputInPopup: true,
      positioner: { side: 'top', sideOffset: -20 },
      root: { 'onUpdate:modelValue': (value: unknown) => values.push(value) },
    });
    await nextTick();
    const trigger = document.querySelector<HTMLElement>('[data-testid="trigger"]')!;
    trigger.style.cssText = 'position: fixed; top: 300px; left: 20px';
    await userEvent.click(trigger);
    await waitFor(() => expect(document.querySelector('[data-testid="popup"]')).not.toBe(null));
    expect(values).toEqual([]);
  });
});
