// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that a part has code only where they do not do it. Where the
// browsers differ, the measurement states each one.
import { afterEach, describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MeasureControlledRadios from '../fixtures/MeasureControlledRadios.vue';
import { mount, settle } from '../render';

let root: HTMLElement | undefined;

afterEach(() => {
  root?.remove();
  root = undefined;
});

/** Three radios a, b and c between two buttons. */
function radios({ name = 'g', checked = '', disabled = '', dir = '', tabindex = false } = {}) {
  root = document.body.appendChild(document.createElement('div'));
  if (dir) root.dir = dir;
  const radio = (id: string) =>
    `<input type="radio" id="${id}" value="${id}" aria-label="${id}"${name ? ` name="${name}"` : ''}${
      checked === id ? ' checked' : ''
    }${disabled === id ? ' disabled' : ''}${tabindex ? ' tabindex="0"' : ''}>`;
  root.innerHTML = `<button id="before">Before</button>${radio('a')}${radio('b')}${radio('c')}<button id="after">After</button>`;
  return root;
}

/** Presses `keys` one after the other from the element `start`, and gives the focus and the checked radio after each. */
async function press(start: string, keys: string[]) {
  root!.querySelector<HTMLElement>(`#${start}`)!.focus();
  const steps: string[] = [];
  for (const key of keys) {
    await userEvent.keyboard(key);
    const checked = [...root!.querySelectorAll<HTMLInputElement>('input:checked')].map((r) => r.id);
    steps.push(
      `${(document.activeElement as HTMLElement).id || 'none'}:${checked.join('') || '-'}`,
    );
  }
  return steps;
}

const looping = server.browser !== 'webkit';

describe('native radios with one name', () => {
  test('the arrow keys move the focus and select, and skip a disabled radio; only Chromium and Firefox loop', async () => {
    radios({ checked: 'b' });
    expect(await press('b', ['{ArrowDown}', '{ArrowDown}', '{ArrowUp}'])).toEqual(
      looping ? ['c:c', 'a:a', 'c:c'] : ['c:c', 'c:c', 'b:b'],
    );
    root!.remove();
    radios({ checked: 'a', disabled: 'b' });
    expect(await press('a', ['{ArrowRight}'])).toEqual(['c:c']);
  });

  test('right-to-left makes ArrowLeft the next radio in Chromium and Firefox, and not in WebKit', async () => {
    radios({ checked: 'a', dir: 'rtl' });
    expect(await press('a', ['{ArrowLeft}'])).toEqual(looping ? ['b:b'] : ['a:a']);
  });

  test('Home and End select nothing; with an arrow, Ctrl, Alt and Meta select nothing in Chromium and Firefox, and act as an arrow in WebKit', async () => {
    const results: Record<string, string> = {};
    for (const key of ['{Home}', '{End}', 'Control', 'Alt', 'Meta']) {
      radios({ checked: 'b' });
      const sequence = key.startsWith('{') ? key : `{${key}>}{ArrowDown}{/${key}}`;
      results[key] = (await press('b', [sequence]))[0]!;
      root!.remove();
    }
    expect(results).toEqual({
      '{Home}': 'b:b',
      '{End}': 'b:b',
      Control: looping ? 'b:b' : 'c:c',
      Alt: looping ? 'b:b' : 'c:c',
      Meta: looping ? 'b:b' : 'c:c',
    });
  });

  test('Tab enters at the checked radio, or the first; Shift+Tab with none checked gives the last in Chromium; WebKit focuses a radio only with a tabindex', async () => {
    radios({ checked: 'b' });
    const webkit = server.browser === 'webkit';
    expect(await press('before', ['{Tab}', '{Tab}'])).toEqual(
      webkit ? ['none:b', 'none:b'] : ['b:b', 'after:b'],
    );
    root!.remove();
    radios();
    expect(await press('after', ['{Shift>}{Tab}{/Shift}'])).toEqual(
      webkit ? ['none:-'] : server.browser === 'chromium' ? ['c:-'] : ['a:-'],
    );
    root!.remove();
    radios({ tabindex: true });
    expect(await press('before', ['{Tab}'])).toEqual(['a:-']);
  });

  test('a click listener that prevents the default keeps the selection; an arrow key still moves the focus', async () => {
    radios({ checked: 'a' });
    root!.addEventListener('click', (event) => event.preventDefault());
    expect(await press('a', ['{ArrowDown}', ' '])).toEqual(['b:a', 'b:a']);
  });

  test('a focus alone selects nothing', () => {
    radios();
    root!.querySelector<HTMLElement>('#b')!.focus();
    expect(root!.querySelector('input:checked')).toBeNull();
  });
});

describe('native radios with no name', () => {
  test('are not one group: Chromium and WebKit check a second radio at an arrow key, Firefox does nothing', async () => {
    radios({ name: '', checked: 'a' });
    expect(await press('a', ['{ArrowDown}'])).toEqual(
      server.browser === 'firefox' ? ['a:a'] : ['b:ab'],
    );
  });
});

describe('a native reset of radios with :checked', () => {
  test('gives the value that Vue bound last, so a parent that keeps its value sees no change', async () => {
    const model = reactive({ value: 'a' as string | null, accept: false });
    const mounted = mount(MeasureControlledRadios, { model }).root;
    const [a] = mounted.querySelectorAll('input');
    mounted.querySelectorAll('input')[1]!.click();
    await settle();
    a!.checked = true;
    mounted.querySelector('form')!.reset();
    expect(a!.checked).toBe(true);
  });

  test('a listener on the window can prevent it, and a timer sees that; each reset is one event', async () => {
    const model = reactive({ value: 'a' as string | null, accept: true });
    const mounted = mount(MeasureControlledRadios, { model }).root;
    await nextTick();
    const form = mounted.querySelector('form')!;
    const seen: boolean[] = [];
    form.addEventListener('reset', (event) => setTimeout(() => seen.push(event.defaultPrevented)));
    const prevent = (event: Event) => event.preventDefault();
    window.addEventListener('reset', prevent);
    form.reset();
    window.removeEventListener('reset', prevent);
    form.reset();
    await settle();
    expect(seen).toEqual([true, false]);
  });
});
