// Measurements for Toast, with native elements and plain Vue, and no code of the library. Each one
// states what the browser or Vue does, so that the family has code only where they do not do it.
// Where the browsers differ, the measurement states each one. Playwright sends a touch only in
// Chromium, so the touch rows run there only.
import { afterEach, describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import {
  createApp,
  h,
  nextTick,
  onBeforeUnmount,
  ref,
  renderSlot,
  TransitionGroup,
  type App,
  type Slots,
} from 'vue';
import { touchDrag } from '../pointer';
import { takeReportedMessages } from '../reportedMessages';

const engine = server.browser;
let root: HTMLElement | undefined;
let app: App | undefined;

afterEach(() => {
  app?.unmount();
  app = undefined;
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

function mountVue(css: string, render: () => ReturnType<typeof h>) {
  html(`<style>${css}</style><div id="app"></div>`);
  app = createApp({ render });
  app.mount(element('app'));
}

const FADE =
  '.t-enter-active, .t-leave-active { transition: opacity 300ms } .t-enter-from, .t-leave-to { opacity: 0 }';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frames = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const activeId = () => document.activeElement?.id || document.activeElement?.localName;

describe('<TransitionGroup>', () => {
  test('a key that comes back while its old element leaves gets a new element at once, with the enter classes and no class at the end', async () => {
    const list = ref(['a', 'b']);
    mountVue(FADE, () =>
      h(TransitionGroup, { name: 't' }, () =>
        list.value.map((id) => h('div', { key: id, 'data-id': id }, id)),
      ),
    );
    const read = () =>
      [...document.querySelectorAll('[data-id="a"]')].map((each) => each.className);
    list.value = ['b'];
    await nextTick();
    expect(read()).toEqual(['t-leave-from t-leave-active']);
    await frames();
    list.value = ['a', 'b'];
    await nextTick();
    expect(read()).toEqual(['t-enter-from t-enter-active']);
    await wait(500);
    expect(read()).toEqual(['']);
  });

  test('Vue does not patch an element that leaves, a DOM write stays, `onBeforeUnmount` comes before the leave classes, and an inline `transition: none` removes the element at once', async () => {
    const list = ref(['a', 'b', 'c']);
    const items: Record<
      string,
      { dir: { value: string }; none: { value: boolean }; el?: Element }
    > = {};
    const Item = {
      props: ['id'],
      setup(props: { id: string }) {
        const item = { dir: ref(''), none: ref(false), el: undefined as Element | undefined };
        items[props.id] = item;
        onBeforeUnmount(() => item.el!.setAttribute('data-unmount', item.el!.className));
        return () =>
          h(
            'div',
            {
              ref: (el: unknown) => (item.el = (el as Element | null) ?? item.el),
              'data-dir': item.dir.value,
              style: item.none.value ? { transition: 'none' } : {},
            },
            props.id,
          );
      },
    };
    mountVue(FADE, () =>
      h(TransitionGroup, { name: 't' }, () => list.value.map((id) => h(Item, { key: id, id }))),
    );
    const a = items.a!.el!;
    items.a!.dir.value = 'right';
    list.value = ['b', 'c'];
    await nextTick();
    expect(a.getAttribute('data-dir')).toBe('');
    expect(a.getAttribute('data-unmount')).toBe('');
    const b = items.b!.el!;
    b.setAttribute('data-dir', 'right');
    list.value = ['c'];
    await nextTick();
    expect(b.getAttribute('data-dir')).toBe('right');
    items.c!.none.value = true;
    await nextTick();
    const c = items.c!.el!;
    list.value = [];
    await nextTick();
    await wait(100);
    expect(c.isConnected).toBe(false);
    expect(a.isConnected).toBe(true);
  });

  test.each([
    {
      name: 'each change has a transition',
      css: '.toast { transition: transform 300ms, opacity 300ms; transform: translateY(calc(var(--i) * -50px)) }',
      writes: false,
    },
    {
      name: 'a change with no transition',
      css: '.toast { transition: transform 300ms, opacity 300ms; bottom: calc(var(--i) * 50px) }',
      writes: true,
    },
    {
      name: 'no transition of transform',
      css: '.toast { transition: opacity 300ms; bottom: calc(var(--i) * 50px) }',
      writes: false,
    },
  ])(
    'the move code of the group writes nothing on a stack where $name',
    async ({ css, writes }) => {
      const list = ref(['b', 'c']);
      mountVue(
        `.vp { position: fixed; bottom: 20px; right: 20px; width: 200px } .toast { position: absolute; bottom: 0; right: 0; width: 100%; height: 40px } ${css} .t-enter-from, .t-leave-to { opacity: 0 }`,
        () =>
          h('div', { class: 'vp' }, [
            h(TransitionGroup, { name: 't' }, () =>
              list.value.map((id, index) =>
                h('div', { key: id, class: 'toast', style: { '--i': index } }, id),
              ),
            ),
          ]),
      );
      let written = false;
      new MutationObserver((records) => {
        for (const record of records) {
          const target = record.target as HTMLElement;
          if (target.style.transform || target.classList.contains('t-move')) written = true;
        }
      }).observe(document.querySelector('.vp')!, {
        attributes: true,
        subtree: true,
        attributeFilter: ['style', 'class'],
      });
      list.value = ['a', 'b', 'c'];
      await nextTick();
      await wait(450);
      list.value = ['b', 'c'];
      await nextTick();
      await wait(450);
      expect(written).toBe(writes);
    },
  );

  test('the element of a slot that is the root of an item gets the enter and the leave classes; Vue warns in development', async () => {
    const list = ref(['b']);
    const Part = {
      props: ['id'],
      setup:
        (props: { id: string }, { slots }: { slots: Slots }) =>
        () =>
          renderSlot(slots, 'element', { props: { 'data-id': props.id } }),
    };
    mountVue(FADE, () =>
      h(TransitionGroup, { name: 't' }, () =>
        list.value.map((id) =>
          h(Part, { key: id, id }, { element: ({ props }: any) => h('section', props, id) }),
        ),
      ),
    );
    list.value = ['a', 'b'];
    await nextTick();
    const a = document.querySelector('[data-id="a"]')!;
    expect(a.className).toBe('t-enter-from t-enter-active');
    await wait(400);
    list.value = ['b'];
    await nextTick();
    expect(a.className).toBe('t-leave-from t-leave-active');
    // The root of the component is the fragment of the slot.
    const messages = takeReportedMessages();
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(message).toContain('renders non-element root node that cannot be animated');
    }
  });

  test('with `duration`, the keyed element stays while its child animates; with none, Vue removes it at once', async () => {
    const results: boolean[] = [];
    for (const duration of [undefined, 200]) {
      const list = ref(['a']);
      mountVue(
        '.inner { transition: opacity 200ms } .t-enter-from .inner, .t-leave-to .inner { opacity: 0 }',
        () =>
          h(TransitionGroup, { name: 't', duration }, () =>
            list.value.map((id) =>
              h('div', { key: id, 'data-id': id }, [h('div', { class: 'inner' }, id)]),
            ),
          ),
      );
      const outer = document.querySelector('[data-id="a"]')!;
      list.value = [];
      await nextTick();
      await wait(100);
      results.push(outer.isConnected);
      app!.unmount();
      app = undefined;
      root!.remove();
    }
    expect(results).toEqual([false, true]);
  });
});

describe('a pointer at rest', () => {
  const LAYOUT =
    '<style>#vp { position: fixed; top: 300px; left: 300px; width: 200px; height: 0 } .toast { position: absolute; top: 0; left: 0; width: 200px; height: 40px; background: #ccc; transition: transform 200ms }</style><div id="vp"></div>';

  async function atRest(change: (vp: HTMLElement) => void, withToast = true) {
    html(LAYOUT);
    const vp = element('vp');
    if (withToast) vp.innerHTML = '<div class="toast" id="a">a</div>';
    const log: string[] = [];
    for (const type of ['mouseenter', 'mouseleave'])
      vp.addEventListener(type, () => log.push(type));
    await userEvent.pointer({ coords: { x: 10, y: 10 } });
    await userEvent.pointer({ coords: { x: 400, y: 320 } });
    await wait(50);
    log.length = 0;
    change(vp);
    await wait(500);
    const atOnce = log.splice(0);
    await userEvent.pointer({ coords: { x: 401, y: 321 } });
    await wait(100);
    return { atOnce, afterAMove: log.splice(0) };
  }

  test('a toast under the pointer gets `inert`: `mouseleave` at the next move in Chromium, and at once or at the next move in Firefox and WebKit', async () => {
    const { atOnce, afterAMove } = await atRest(() => (element('a').inert = true));
    expect([...atOnce, ...afterAMove]).toEqual(['mouseleave']);
    if (engine === 'chromium') expect(atOnce).toEqual([]);
  });

  test('a toast under the pointer leaves the document: `mouseleave` at once in Firefox, at once or at the next move in Chromium, never in WebKit, which sends a `mouseover` outside', async () => {
    const overs: string[] = [];
    const onMouseover = (event: MouseEvent) =>
      overs.push((event.target as Element).id || (event.target as Element).localName);
    try {
      const result = await atRest(() => {
        document.addEventListener('mouseover', onMouseover, true);
        element('a').remove();
      });
      // On a busy machine, Chromium can send it at the next move (seen in CI).
      expect([...result.atOnce, ...result.afterAMove]).toEqual(
        engine === 'webkit' ? [] : ['mouseleave'],
      );
      if (engine === 'firefox') expect(result.atOnce).toEqual(['mouseleave']);
      expect(overs.length).toBeGreaterThan(0);
      expect(overs).not.toContain('a');
    } finally {
      document.removeEventListener('mouseover', onMouseover, true);
    }
  });

  test('a toast under the pointer moves away in a transition: `mouseleave` at once in Firefox and WebKit, at the next move in Chromium', async () => {
    const { atOnce, afterAMove } = await atRest(
      () => (element('a').style.transform = 'translateX(400px)'),
    );
    // WebKit can send `mouseenter` and `mouseleave` again in the transition.
    expect([atOnce.at(-1), afterAMove]).toEqual(
      engine === 'chromium' ? [undefined, ['mouseleave']] : ['mouseleave', []],
    );
  });

  test('a toast comes under the pointer: `mouseenter` at once in Firefox and WebKit, at the next move in Chromium', async () => {
    const result = await atRest(
      (vp) => (vp.innerHTML = '<div class="toast" id="a">a</div>'),
      false,
    );
    expect(result).toEqual(
      engine === 'chromium'
        ? { atOnce: [], afterAMove: ['mouseenter'] }
        : { atOnce: ['mouseenter'], afterAMove: [] },
    );
  });
});

describe('the size of a content', () => {
  test.each([
    { name: 'height auto', style: '', calls: 1 },
    { name: 'height 100%', style: 'height: 100%', calls: 0 },
  ])(
    'a ResizeObserver on a content with $name in a root of a fixed height gets $calls calls when its text grows',
    async ({ style, calls }) => {
      html(
        `<div style="width: 200px; height: 20px; overflow: hidden"><div id="content" style="${style}">short</div></div>`,
      );
      let count = 0;
      const observer = new ResizeObserver(() => (count += 1));
      observer.observe(element('content'));
      await frames();
      const first = count;
      element('content').textContent =
        'a much longer text that wraps onto more lines than one, two, three, four, five lines';
      await frames();
      observer.disconnect();
      expect(count - first).toBe(calls);
    },
  );
});

describe('the focus of the window', () => {
  test('the focus that goes into a frame of the page gives the window `blur`; one task later the page has the focus and the frame is the active element in the three', async () => {
    html(
      `<button id="outer">Outer</button><iframe id="frame" title="Frame" style="width: 200px; height: 100px" srcdoc="<button style='width: 150px; height: 60px'>In</button>"></iframe>`,
    );
    const frame = element<HTMLIFrameElement>('frame');
    await new Promise((resolve) => {
      if (
        frame.contentDocument?.readyState === 'complete' &&
        frame.contentDocument.body?.firstChild
      )
        resolve(null);
      else frame.addEventListener('load', resolve, { once: true });
    });
    const log: string[] = [];
    const onBlur = () => {
      const atEvent = `${document.hasFocus()} ${document.activeElement?.localName}`;
      setTimeout(() =>
        log.push(`${atEvent}, later ${document.hasFocus()} ${document.activeElement?.localName}`),
      );
    };
    window.addEventListener('blur', onBlur);
    try {
      element('outer').focus();
      await userEvent.keyboard('{Tab}');
      await wait(100);
      element('outer').focus();
      const rect = frame.getBoundingClientRect();
      await userEvent.pointer({
        coords: { x: rect.left + 40, y: rect.top + 30 },
        keys: '[MouseLeft]',
      });
      await wait(100);
      // In the test frame, Firefox gives `false` for the focus of the page at the event.
      const atEvent = engine === 'firefox' ? 'false body' : 'true iframe';
      expect(log).toEqual([`${atEvent}, later true iframe`, `${atEvent}, later true iframe`]);
    } finally {
      window.removeEventListener('blur', onBlur);
    }
  });
});

describe('Tab and the sentinels', () => {
  test.each([
    {
      name: 'beside',
      markup:
        '<input id="before" aria-label="Before"><span id="s1" tabindex="0"></span><div id="vp" tabindex="-1"><div id="t1" tabindex="0" inert>1</div><div id="t2" tabindex="0">2<input id="i2" aria-label="Two"></div><div id="t3" tabindex="0">3</div></div><span id="s2" tabindex="0"></span><input id="after" aria-label="After">',
      forward: ['t2', 'i2', 't3', 's2'],
    },
    {
      name: 'in',
      markup:
        '<input id="before" aria-label="Before"><div id="vp" tabindex="-1"><span id="s1" tabindex="0"></span><div id="t1" tabindex="0" inert>1</div><div id="t2" tabindex="0">2<input id="i2" aria-label="Two"></div><div id="t3" tabindex="0">3</div><span id="s2" tabindex="0"></span></div><input id="after" aria-label="After">',
      forward: ['s1', 't2', 'i2', 't3'],
    },
  ])(
    'with the sentinels $name the container, Tab from the container skips an inert root, and Shift+Tab from the first root goes to the first sentinel',
    async ({ markup, forward }) => {
      html(markup);
      element('vp').focus();
      const order: (string | undefined)[] = [];
      for (let index = 0; index < 4; index += 1) {
        await userEvent.keyboard('{Tab}');
        order.push(activeId());
      }
      expect(order).toEqual(forward);
      element('t2').focus();
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
      expect(activeId()).toBe('s1');
    },
  );
});

describe('a touch', () => {
  // A page that scrolls on the two axes, with a fixed box.
  function touchBox(touchAction: string) {
    html(
      `<div style="height: 3000px; width: 3000px"><div id="box" style="position: fixed; left: 50px; top: 100px; width: 300px; height: 80px; touch-action: ${touchAction}">box</div></div>`,
    );
    const box = element('box');
    const log: string[] = [];
    let down: PointerEvent | undefined;
    const types = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'mouseleave'];
    for (const type of types) {
      box.addEventListener(type, (event) => {
        if (type === 'pointerdown') down = event as PointerEvent;
        if (type === 'pointermove') {
          const move = event as PointerEvent;
          if (!log.some((each) => each.startsWith('first move')))
            log.push(
              `first move ${Math.hypot(move.clientX - down!.clientX, move.clientY - down!.clientY)}`,
            );
          return;
        }
        log.push(type);
      });
    }
    return { box, log };
  }

  test.skipIf(engine !== 'chromium').each([
    { touchAction: 'auto', dx: 12, dy: 0, end: 'pointercancel' },
    { touchAction: 'none', dx: 12, dy: 0, end: 'pointerup' },
    { touchAction: 'none', dx: 0, dy: 12, end: 'pointerup' },
    { touchAction: 'pan-y', dx: 12, dy: 0, end: 'pointerup' },
    { touchAction: 'pan-y', dx: 0, dy: 12, end: 'pointercancel' },
    { touchAction: 'pan-x', dx: 12, dy: 0, end: 'pointercancel' },
    { touchAction: 'pan-x', dx: 0, dy: 12, end: 'pointerup' },
  ])(
    'a touch drag on `touch-action: $touchAction` by ($dx, $dy) ends with $end, and sends no `mouseleave`',
    async ({ touchAction, dx, dy, end }) => {
      const { log } = touchBox(touchAction);
      const start = { x: 200, y: 140 };
      await touchDrag(start, { x: start.x + dx * 10, y: start.y + dy * 10 }, 10);
      await wait(100);
      expect(log.filter((each) => !each.startsWith('first move'))).toEqual(['pointerdown', end]);
    },
  );

  test.skipIf(engine !== 'chromium').each([
    { touchAction: 'none', dx: 1, dy: 0 },
    { touchAction: 'pan-y', dx: 1, dy: 0 },
    { touchAction: 'pan-x', dx: 0, dy: 1 },
  ])(
    'the first `pointermove` of a touch drag on `touch-action: $touchAction` in steps of 1 px comes at 1 px',
    async ({ touchAction, dx, dy }) => {
      const { log } = touchBox(touchAction);
      const start = { x: 200, y: 140 };
      await touchDrag(start, { x: start.x + dx * 40, y: start.y + dy * 40 }, 40);
      await wait(100);
      expect(log).toEqual(['pointerdown', 'first move 1', 'pointerup']);
    },
  );
});

describe('a focused element that leaves', () => {
  test('leaves the focus on <body>; only Chromium sends `focusout`; the next Tab goes on after its place', async () => {
    html(
      '<div id="vp" tabindex="-1"><div id="a" tabindex="0">a</div><div id="b" tabindex="0">b</div></div>',
    );
    const log: string[] = [];
    element('vp').addEventListener('focusout', () => log.push('focusout'));
    element('a').focus();
    element('a').remove();
    await wait(50);
    expect(log).toEqual(engine === 'chromium' ? ['focusout'] : []);
    expect(activeId()).toBe('body');
    await userEvent.keyboard('{Tab}');
    expect(activeId()).toBe('b');
  });

  test('a focused root that gets `inert` sends `focusout`, and the focus goes to <body>', async () => {
    html('<div id="vp" tabindex="-1"><div id="a" tabindex="0">a</div></div>');
    const log: string[] = [];
    element('vp').addEventListener('focusout', () => log.push('focusout'));
    element('a').focus();
    element('a').inert = true;
    await wait(150);
    expect(log).toEqual(['focusout']);
    expect(activeId()).toBe('body');
  });

  test('`blur()` on the focused root sends `focusout` with no related target; the later removal sends nothing', async () => {
    html(
      '<div id="vp"><div id="a" tabindex="0">a</div><div id="b" tabindex="0" inert>b</div></div>',
    );
    const log: string[] = [];
    element('vp').addEventListener('focusout', (event) =>
      log.push(`focusout ${(event.relatedTarget as Element | null)?.id ?? null}`),
    );
    element('a').focus();
    element('a').blur();
    expect(log).toEqual(['focusout null']);
    expect(activeId()).toBe('body');
    element('a').remove();
    await wait(100);
    expect(log).toEqual(['focusout null']);
  });
});

describe(':focus-visible', () => {
  test.each([{ options: undefined }, { options: { focusVisible: true } }])(
    'a root that a key listener focuses after Tab matches :focus-visible, with the options $options',
    async ({ options }) => {
      html(
        '<input id="before" aria-label="Before"><div id="vp" tabindex="-1"><div id="a" tabindex="0">a</div><div id="b" tabindex="0">b</div></div>',
      );
      element('a').addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        element('b').focus(options as FocusOptions | undefined);
        element('a').remove();
      });
      element('before').focus();
      await userEvent.keyboard('{Tab}');
      await userEvent.keyboard('{Escape}');
      expect(activeId()).toBe('b');
      expect(element('b').matches(':focus-visible')).toBe(true);
    },
  );

  test.each(['a press on a button', 'Tab', 'a press on a text input', 'no focus'])(
    'a region that an F6 listener focuses with `preventScroll` matches :focus-visible after $0',
    async (origin) => {
      html(
        '<input id="text" aria-label="Text"><button id="button">Button</button><div id="vp" tabindex="-1">Region</div>',
      );
      const onKeydown = (event: KeyboardEvent) => {
        if (event.key !== 'F6') return;
        event.preventDefault();
        element('vp').focus({ preventScroll: true });
      };
      window.addEventListener('keydown', onKeydown);
      try {
        if (origin === 'a press on a button') await userEvent.click(element('button'));
        else if (origin === 'Tab') {
          element('text').focus();
          await userEvent.keyboard('{Tab}');
        } else if (origin === 'a press on a text input') await userEvent.click(element('text'));
        await userEvent.keyboard('{F6}');
        expect(activeId()).toBe('vp');
        expect(element('vp').matches(':focus-visible')).toBe(true);
      } finally {
        window.removeEventListener('keydown', onKeydown);
      }
    },
  );

  test('a mouse press on a root and on a button in it gives no :focus-visible; WebKit on macOS focuses the root for the button', async () => {
    html(
      '<div id="root" tabindex="0" style="width: 300px; height: 80px"><button id="close">Close</button></div>',
    );
    await userEvent.click(element('root'), { position: { x: 20, y: 60 } });
    expect(activeId()).toBe('root');
    expect(element('root').matches(':focus-visible')).toBe(false);
    await userEvent.click(element('close'));
    // WebKit on Linux focuses the button.
    expect(activeId()).toBe(
      engine === 'webkit' && navigator.platform.startsWith('Mac') ? 'root' : 'close',
    );
    expect(document.activeElement!.matches(':focus-visible')).toBe(false);
  });
});

describe('a mouse drag on text', () => {
  test.each(['both axes', 'one axis'])(
    'with the box on $0, an inline `user-select: none` from the press selects nothing in the three; with no rule WebKit selects text, and Firefox on one axis; `preventDefault()` of `pointermove` does not stop Firefox on one axis',
    async (axes) => {
      const selected: Record<string, boolean> = {};
      for (const how of ['nothing', 'pointermove', 'user-select']) {
        html(
          '<div id="box" tabindex="0" style="position: fixed; left: 100px; top: 100px; width: 300px; height: 200px; transform: translate(var(--x, 0px), var(--y, 0px))"><p>Some text in the box that a drag can select, on more than one line of the box.</p></div>',
        );
        const box = element('box');
        let start: PointerEvent | null = null;
        box.addEventListener('pointerdown', (event) => {
          start = event;
          box.setPointerCapture(event.pointerId);
          if (how === 'user-select') {
            box.style.setProperty('user-select', 'none');
            box.style.setProperty('-webkit-user-select', 'none');
          }
        });
        box.addEventListener('pointermove', (event) => {
          if (!start) return;
          if (how === 'pointermove') event.preventDefault();
          if (axes === 'both axes')
            box.style.setProperty('--x', `${event.clientX - start.clientX}px`);
          box.style.setProperty('--y', `${event.clientY - start.clientY}px`);
        });
        getSelection()?.removeAllRanges();
        let point = { x: 150, y: 125 };
        await userEvent.pointer({ coords: point, keys: '[MouseLeft>]' });
        try {
          for (let step = 1; step <= 8; step += 1) {
            point = { x: 150 + step * 12, y: 125 + step * 15 };
            await userEvent.pointer({ coords: point });
          }
          selected[how] = String(getSelection()).length > 0;
        } finally {
          await userEvent.pointer({ coords: point, keys: '[/MouseLeft]' });
        }
        root!.remove();
      }
      const oneAxisFirefox = engine === 'firefox' && axes === 'one axis';
      expect(selected).toEqual({
        nothing: engine === 'webkit' || oneAxisFirefox,
        pointermove: oneAxisFirefox,
        'user-select': false,
      });
    },
  );
});
