// Measurements for Select and its list: with native elements and plain Vue, and through the parts
// ("the parts"). Each one states what the browser or Vue does, so that the parts have code only
// where they do not do it. In the Vapor setups, "animation" of `Select.test.ts` measures the parts.
import { afterEach, describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import {
  createApp,
  defineComponent,
  h,
  nextTick,
  onMounted,
  shallowRef,
  Transition,
  vShow,
  withDirectives,
} from 'vue';
import SelectParts from '../fixtures/SelectParts.vue';
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

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('a key on a closed native select', () => {
  test('selects the next option whose text starts with it, with `input` and `change`, and no popup', async () => {
    html(
      '<select id="s"><option>Apple</option><option>Banana</option><option>Cherry</option></select>',
    );
    const select = element<HTMLSelectElement>('s');
    const log: string[] = [];
    select.addEventListener('input', () => log.push(`input ${select.value}`));
    select.addEventListener('change', () => log.push(`change ${select.value}`));
    select.focus();
    await userEvent.keyboard('c');
    expect(select.value).toBe('Cherry');
    expect(log).toEqual(['input Cherry', 'change Cherry']);
  });
});

describe('a visually hidden required input', () => {
  test.each(['text', 'hidden'])(
    'of type %s: a text input validates and takes the focus at a failure; a hidden input does not validate',
    (type) => {
      html(
        `<form id="f"><button id="t" type="button">Trigger</button><input id="h" type="${type}" name="n" required tabindex="-1" aria-hidden="true" style="position: absolute; clip-path: inset(50%); width: 1px; height: 1px"></form>`,
      );
      const input = element<HTMLInputElement>('h');
      const valid = element<HTMLFormElement>('f').reportValidity();
      expect(input.willValidate).toBe(type === 'text');
      expect(valid).toBe(type !== 'text');
      expect(document.activeElement === input).toBe(type === 'text');
    },
  );
});

const PopupInTransition = defineComponent({
  props: { open: Boolean, hidden: Boolean, oneUpdateLater: Boolean },
  setup(props) {
    const mounted = shallowRef(!props.oneUpdateLater);
    onMounted(() => (mounted.value = true));
    return () =>
      withDirectives(
        h('div', {
          id: 'p',
          class: props.hidden ? undefined : 'flex',
          hidden: props.hidden && !props.open ? true : undefined,
        }),
        [[vShow, props.open && mounted.value]],
      );
  },
});

function mountTransition(
  state: { open: boolean },
  options: { hidden?: boolean; oneUpdateLater?: boolean; appear?: boolean },
) {
  const log: string[] = [];
  const open = shallowRef(state.open);
  const app = defineComponent({
    setup: () => () =>
      h(
        Transition,
        {
          name: 'pop',
          appear: options.appear,
          onBeforeEnter: () => log.push('before-enter'),
          onAfterEnter: () => log.push('after-enter'),
          onBeforeLeave: () => log.push('before-leave'),
          onAfterLeave: () => log.push('after-leave'),
        },
        () =>
          h(PopupInTransition, {
            open: open.value,
            hidden: options.hidden,
            oneUpdateLater: options.oneUpdateLater,
          }),
      ),
  });
  // A virtual DOM app in each setup: the measurement is of Vue, with no part.
  const host = root!.appendChild(document.createElement('div'));
  const instance = createApp(app);
  instance.mount(host);
  onTestFinished(() => instance.unmount());
  return { log, open };
}

const STYLE = `.flex { display: flex } .pop-enter-active, .pop-leave-active { transition: opacity 100ms linear } .pop-enter-from, .pop-leave-to { opacity: 0 }`;

describe('v-show on the root element of a component in a <Transition> of the developer', () => {
  test('runs the enter and the leave with one call of each hook; the closed element has display none, and the leave needs no CSS rule', async () => {
    html(`<style>${STYLE}</style>`);
    const { log, open } = mountTransition({ open: false }, {});
    await nextTick();
    expect(getComputedStyle(element('p')).display).toBe('none');
    open.value = true;
    await waitFor(() => expect(log).toEqual(['before-enter', 'after-enter']));
    open.value = false;
    await nextTick();
    await nextFrame();
    expect(getComputedStyle(element('p')).display).toBe('flex');
    await waitFor(() => expect(log.slice(2)).toEqual(['before-leave', 'after-leave']));
    expect(getComputedStyle(element('p')).display).toBe('none');
  });

  test('an element that shows one update after an open mount has the enter with no `appear`; `appear` gives a second before-enter', async () => {
    html(`<style>${STYLE}</style>`);
    const later = mountTransition({ open: true }, { oneUpdateLater: true });
    await waitFor(() => expect(later.log).toEqual(['before-enter', 'after-enter']));
    root?.querySelector('#p')?.remove();
    const appear = mountTransition({ open: true }, { appear: true });
    await waitFor(() => expect(appear.log).toContain('after-enter'));
    expect(appear.log.filter((entry) => entry === 'before-enter')).toHaveLength(2);
  });

  test('with `hidden` while closed and no display rule, the leave shows nothing with no display rule on the -leave-active class', async () => {
    html(`<style>${STYLE}</style>`);
    const { log, open } = mountTransition({ open: true }, { hidden: true });
    await nextTick();
    open.value = false;
    await nextTick();
    await nextFrame();
    expect(getComputedStyle(element('p')).display).toBe('none');
    await waitFor(() => expect(log).toEqual(['before-leave', 'after-leave']));
  });
});

describe('an invisible box of a closed popup at an old place', () => {
  test.each([
    {
      name: 'a box with a size',
      style: 'width: 200px; height: 300px; visibility: hidden',
      grows: true,
    },
    { name: 'a box with a height of 0', style: 'width: 200px; height: 0', grows: false },
  ])('makes the page scroll further only for $name', ({ style, grows }) => {
    const page = document.documentElement;
    const before = page.scrollHeight;
    html(`<div style="position: absolute; top: 3000px; left: 0; ${style}"></div>`);
    expect(page.scrollHeight > before).toBe(grows);
  });
});

describe('a click on a native label of a button', () => {
  test('gives the button one `click` and no `pointerdown`; `detail` is 0 in WebKit only', async () => {
    html(
      '<label id="l" for="b" style="display: block; height: 30px">Label</label><button id="b" type="button">B</button>',
    );
    const log: string[] = [];
    element('b').addEventListener('pointerdown', () => log.push('pointerdown'));
    element('b').addEventListener('click', (event) => log.push(`click ${event.detail}`));
    await userEvent.click(element('l'));
    expect(log).toEqual([`click ${server.browser === 'webkit' ? 0 : 1}`]);
  });
});

describe('a press on a button that has the focus', () => {
  test.each(['none', 'mousedown'])(
    'with preventDefault() at %s: the button keeps the focus; in WebKit on macOS, `none` gives the focus to `<body>`',
    async (prevented) => {
      html('<button id="b" type="button">B</button>');
      if (prevented === 'mousedown') {
        element('b').addEventListener('mousedown', (event) => event.preventDefault());
      }
      element('b').focus();
      await userEvent.pointer({ coords: centerOf(element('b')), keys: '[MouseLeft]' });
      const webkitOnMac = server.browser === 'webkit' && server.platform === 'darwin';
      const lost = prevented === 'none' && webkitOnMac;
      expect(document.activeElement).toBe(lost ? document.body : element('b'));
    },
  );
});

describe('a popup that a press shows under the pointer', () => {
  test('gets `pointerup`; the `click` of the press goes to the common ancestor of the trigger and the popup', async () => {
    html(
      '<button id="t" type="button" style="position: absolute; left: 50px; top: 50px; width: 200px; height: 40px">T</button><div id="pop" hidden style="position: absolute; left: 40px; top: 20px; width: 220px; height: 100px"><div id="item" style="height: 100px">Item</div></div>',
    );
    element('t').addEventListener('pointerdown', () => (element('pop').hidden = false));
    const log: string[] = [];
    for (const type of ['pointerup', 'click']) {
      document.addEventListener(
        type,
        (event) =>
          log.push(
            `${type} ${(event.target as Element).id || (event.target as Element).localName}`,
          ),
        true,
      );
    }
    await userEvent.pointer({ coords: centerOf(element('t')), keys: '[MouseLeft]' });
    expect(log).toEqual(['pointerup item', `click ${root!.localName}`]);
  });
});

describe('the focus ring after a submit that the validation blocks', () => {
  test.each([
    { option: {}, ring: server.browser === 'webkit' },
    { option: { focusVisible: true }, ring: true },
  ])(
    'a button that gets the focus from the invalid input with $option has `:focus-visible`: $ring',
    async ({ option, ring }) => {
      html(
        '<form id="f"><button id="t" type="button">T</button><input id="h" required tabindex="-1" style="position: absolute; width: 1px; height: 1px"><button id="s">Submit</button></form>',
      );
      element('f').addEventListener('submit', (event) => event.preventDefault());
      element('h').addEventListener('focus', () => element('t').focus(option));
      await userEvent.click(element('s'));
      expect(document.activeElement).toBe(element('t'));
      expect(element('t').matches(':focus-visible')).toBe(ring);
    },
  );
});

describe('the list', () => {
  test('`focus()` puts an item in the middle of a list that scrolls; `preventScroll` and `scrollIntoView` with `nearest` scroll one row', async () => {
    html(
      `<div id="list" style="height: 90px; overflow: auto">${Array.from({ length: 10 }, (_, index) => `<div id="i${index}" tabindex="-1" style="height: 30px">${index}</div>`).join('')}</div>`,
    );
    element('i3').focus();
    await nextFrame();
    expect(element('list').scrollTop).toBe(60);
    element('list').scrollTop = 0;
    element('i3').focus({ preventScroll: true });
    element('i3').scrollIntoView({ block: 'nearest', inline: 'nearest' });
    await nextFrame();
    expect(element('list').scrollTop).toBe(30);
  });

  test('an element that appears under a pointer that rests gets `pointerover` and no `pointermove`', async () => {
    html(
      '<div id="target" style="position: fixed; left: 0; top: 0; width: 100px; height: 100px"></div>',
    );
    await userEvent.pointer({ coords: { x: 50, y: 50 } });
    const log: string[] = [];
    const added = document.createElement('div');
    added.style.cssText = 'position: fixed; left: 0; top: 0; width: 100px; height: 100px';
    for (const type of ['pointerover', 'pointermove'])
      added.addEventListener(type, () => log.push(type));
    root!.append(added);
    await wait(100);
    expect(log).not.toContain('pointermove');
  });

  test('a move in one step sends `pointerover` and then `pointermove` at one position', async () => {
    html('<div id="a" style="height: 40px">A</div><div id="b" style="height: 40px">B</div>');
    await userEvent.pointer({ coords: centerOf(element('a')) });
    const log: string[] = [];
    for (const type of ['pointerover', 'pointermove']) {
      element('b').addEventListener(type, (event) =>
        log.push(`${type} ${(event as PointerEvent).clientY}`),
      );
    }
    await userEvent.pointer({ coords: centerOf(element('b')) });
    const y = centerOf(element('b')).y;
    expect(log.slice(0, 2)).toEqual([`pointerover ${y}`, `pointermove ${y}`]);
  });
});

describe('a CSS zoom on <html>', () => {
  test.each([0.9, 1.25])(
    'of %s: `clientWidth` and `clientHeight` of <html> and the rectangles are in pixels of the view, and the styles of a fixed element are in its own pixels',
    (zoom) => {
      const view = document.documentElement;
      const size = [view.clientWidth, view.clientHeight];
      view.style.zoom = String(zoom);
      onTestFinished(() => {
        view.style.removeProperty('zoom');
      });
      html(`<div id="view" style="position: fixed; inset: 0"></div>
        <div id="box" style="position: fixed; top: 400px; height: 100px"></div>`);
      const fixed = element('view');
      const { width, height } = fixed.getBoundingClientRect();
      expect({
        client: [view.clientWidth, view.clientHeight],
        rectangle: [width, height],
        offset: [fixed.offsetWidth, fixed.offsetHeight],
        top: element('box').getBoundingClientRect().top,
      }).toEqual({
        client: size,
        rectangle: size,
        offset: size.map((length) => Math.round(length / zoom)),
        top: 400 * zoom,
      });
    },
  );
});

describe('the parts', () => {
  test('a kept positioner shows its new place in the first frame of its second open, after its anchor moved', async () => {
    mount(SelectParts);
    await nextTick();
    const trigger = document.querySelector<HTMLElement>('[data-testid="trigger"]')!;
    await userEvent.click(trigger);
    const positioner = () => document.querySelector<HTMLElement>('[data-testid="positioner"]')!;
    await waitFor(() => expect(positioner().style.visibility).toBe(''));
    await userEvent.keyboard('{Escape}');
    trigger.style.marginLeft = '120px';
    const width = document.documentElement.scrollWidth;
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    await nextFrame();
    const placed = positioner().getBoundingClientRect();
    expect(Math.abs(placed.left - trigger.getBoundingClientRect().left)).toBeLessThan(40);
    expect(document.documentElement.scrollWidth).toBe(width);
  });

  test('the rectangle of a popup with a `transform` of an enter class is smaller than its place, so the alignment reads it with no transform', async () => {
    html('<style>.small { transform: scale(0.5) }</style>');
    mount(SelectParts, {
      root: { defaultValue: 'banana' },
      popup: { class: 'small' },
      positioner: {},
      trigger: { style: 'margin-top: 200px' },
    });
    await nextTick();
    const trigger = document.querySelector<HTMLElement>('[data-testid="trigger"]')!;
    await userEvent.click(trigger);
    const text = () => document.querySelector('[data-testid="item-banana"] > div')!;
    await waitFor(() => expect(document.activeElement).toBe(text().parentElement));
    const popup = document.querySelector<HTMLElement>('[data-testid="popup"]')!;
    expect(popup.getBoundingClientRect().height).toBeLessThan(popup.offsetHeight);
    popup.classList.remove('small');
    const value = document.querySelector('[data-testid="value"]')!.getBoundingClientRect();
    const rect = text().getBoundingClientRect();
    expect(Math.abs(rect.top + rect.height / 2 - (value.top + value.height / 2))).toBeLessThan(1);
  });

  test('a trigger in a scaled element: the rectangles have the scale, and the item text of a popup in <body> is over the value with no division', async () => {
    mount(SelectParts, {
      root: {
        defaultValue: 'banana',
        style: 'transform: scale(1.25); transform-origin: 0 0; margin-top: 200px',
      },
      positioner: {},
    });
    await nextTick();
    const trigger = document.querySelector<HTMLElement>('[data-testid="trigger"]')!;
    // `offsetWidth` is a whole number.
    expect(trigger.getBoundingClientRect().width / trigger.offsetWidth).toBeCloseTo(1.25, 1);
    await userEvent.click(trigger);
    const text = () => document.querySelector('[data-testid="item-banana"] > div')!;
    await waitFor(() => expect(document.activeElement).toBe(text().parentElement));
    const value = document.querySelector('[data-testid="value"]')!.getBoundingClientRect();
    const rect = text().getBoundingClientRect();
    expect(Math.abs(rect.top + rect.height / 2 - (value.top + value.height / 2))).toBeLessThan(1);
    expect(Math.abs(rect.left - value.left)).toBeLessThan(1);
  });

  test('an item gets the `keyup` of an Enter held on the trigger while the focus moves to it, and no `click`; a `click` of a script selects', async () => {
    mount(SelectParts);
    await nextTick();
    const trigger = document.querySelector<HTMLElement>('[data-testid="trigger"]')!;
    trigger.focus();
    await userEvent.keyboard('{Enter>}');
    const apple = () => document.querySelector<HTMLElement>('[data-testid="item-apple"]')!;
    await waitFor(() => expect(document.activeElement).toBe(apple()));
    await userEvent.keyboard('{/Enter}');
    const value = document.querySelector('[data-testid="value"]')!;
    expect(value.textContent).toBe('');
    apple().click();
    await nextTick();
    expect(value.textContent).toBe('apple');
  });
});
