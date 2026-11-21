// Measurements for Navigation Menu. The cases outside "the parts" use native elements and plain
// Vue, with no code of the library.
import { afterEach, describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MeasureScopedTeleport from '../fixtures/MeasureScopedTeleport.vue';
import MeasureTeleportScene from '../fixtures/MeasureTeleportScene.vue';
import NavigationMenuParts from '../fixtures/NavigationMenuParts.vue';
import { mount } from '../render';
import { takeReportedMessages } from '../reportedMessages';
import { waitFor } from '../waitFor';

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const get = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;

let root: HTMLElement | undefined;

afterEach(() => {
  root?.remove();
  root = undefined;
});

function sceneOf(setup: Partial<{ shown: string | null; target: 'view' | null; popup: boolean }>) {
  return reactive({
    shown: null as string | null,
    target: null as 'view' | null,
    popup: true,
    direction: 'none',
    ...setup,
  });
}

/** Each part element: where it is, its name and its classes. */
function parts(host: ParentNode) {
  return [...host.querySelectorAll<HTMLElement>('[data-name]')].map(
    (element) =>
      `${element.parentElement!.className}:${element.dataset.name}:${element.className.replace('x', '').trim() || '-'}`,
  );
}

describe('a <Transition> of the developer around a part with a <Teleport> root', () => {
  test('the element gets the enter and the leave classes', async () => {
    const scene = sceneOf({ target: 'view' });
    ({ root } = mount(MeasureTeleportScene, { scene, around: true }));
    await nextTick();
    scene.shown = 'a';
    await nextTick();
    const enterStart = parts(root);
    await frame();
    await frame();
    const enterNext = parts(root);
    scene.shown = null;
    await nextTick();
    const leaveStart = parts(root);
    await waitFor(() => expect(parts(root!)).toEqual([]));
    expect(enterStart).toEqual(['view:a:t-enter-from t-enter-active']);
    expect(enterNext).toEqual(['view:a:t-enter-active t-enter-to']);
    expect(leaveStart).toEqual(['view:a:t-leave-from t-leave-active']);
    takeReportedMessages();
  });

  test('one part leaves while another enters in the same target', async () => {
    const scene = sceneOf({ target: 'view', shown: 'a' });
    ({ root } = mount(MeasureTeleportScene, { scene, around: true }));
    await nextTick();
    await wait(150);
    scene.shown = 'b';
    await nextTick();
    expect(parts(root)).toEqual([
      'view:a:t-leave-from t-leave-active',
      'view:b:t-enter-from t-enter-active',
    ]);
    takeReportedMessages();
  });
});

describe('a disabled <Teleport> with no target', () => {
  test('renders in place with no warning, and the same element moves to a target and back with the text of its input', async () => {
    const scene = sceneOf({ shown: 'a' });
    ({ root } = mount(MeasureTeleportScene, { scene }));
    await nextTick();
    const element = root.querySelector('[data-name="a"]')!;
    root.querySelector('input')!.value = 'text';
    expect(parts(root)).toEqual(['item:a:-']);
    scene.target = 'view';
    await nextTick();
    expect(parts(root)).toEqual(['view:a:-']);
    expect(root.querySelector('[data-name="a"]')).toBe(element);
    scene.target = null;
    await nextTick();
    expect(parts(root)).toEqual(['item:a:-']);
    expect(root.querySelector('[data-name="a"]')).toBe(element);
    expect(root.querySelector('input')!.value).toBe('text');
    expect(takeReportedMessages()).toEqual([]);
  });
});

describe('a target in an element that leaves', () => {
  test('the ref of the target gets null at the close; the content stays in it for the leave, and goes with it', async () => {
    const scene = sceneOf({ target: 'view', shown: 'a' });
    const refs: (string | null)[] = [];
    ({ root } = mount(MeasureTeleportScene, {
      scene,
      refs: { add: (value: string | null) => refs.push(value) },
    }));
    await nextTick();
    const content = root.querySelector('[data-name="a"]')!;
    const popup = root.querySelector('.popup')!;
    refs.length = 0;
    scene.popup = false;
    await nextTick();
    expect(refs).toEqual([null]);
    expect(popup.className).toContain('p-leave-active');
    expect(popup.contains(content)).toBe(true);
    await waitFor(() => expect(popup.isConnected).toBe(false));
    expect(content.isConnected).toBe(false);
    expect(takeReportedMessages()).toEqual([]);
  });
});

describe('an element that leaves', () => {
  test('Vue writes no attribute on it in the update of its leave', async () => {
    const scene = sceneOf({ target: 'view', shown: 'a' });
    ({ root } = mount(MeasureTeleportScene, { scene, around: true }));
    await nextTick();
    await wait(150);
    const old = root.querySelector<HTMLElement>('[data-name="a"]')!;
    Object.assign(scene, { shown: 'b', direction: 'right' });
    await nextTick();
    const next = root.querySelector<HTMLElement>('[data-name="b"]')!;
    expect(next.dataset.direction).toBe('right');
    expect(old.dataset.direction).toBe('none');
    takeReportedMessages();
  });
});

describe('the scope id of the parent', () => {
  test('reaches the element of a part with an element root, and not that of a part with a <Teleport> root', async () => {
    ({ root } = mount(MeasureScopedTeleport));
    await nextTick();
    const outline = (name: string) =>
      getComputedStyle(root!.querySelector(`[data-name="${name}"]`)!).outlineStyle;
    expect(outline('plain')).toBe('solid');
    expect(outline('teleported')).toBe('none');
  });
});

describe('a real pointer that crosses an element', () => {
  test('the element under a point of the path gets pointerenter', async () => {
    root = document.body.appendChild(document.createElement('div'));
    root.innerHTML =
      '<div style="display: flex; padding: 20px"><button id="a" style="width: 80px">A</button><button id="b" style="width: 80px">B</button></div><div id="box" style="margin-left: 20px; width: 400px; height: 100px"></div>';
    const entered: string[] = [];
    for (const id of ['a', 'b', 'box']) {
      root.querySelector(`#${id}`)!.addEventListener('pointerenter', () => entered.push(id));
    }
    const a = root.querySelector('#a')!.getBoundingClientRect();
    const box = root.querySelector('#box')!.getBoundingClientRect();
    const from = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
    const to = { x: box.right - 10, y: box.top + 10 };
    for (let index = 0; index <= 8; index += 1) {
      const t = index / 8;
      await userEvent.hover(document.documentElement, {
        position: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
      });
    }
    expect(entered).toEqual(['a', 'b', 'box']);
  });
});

describe('Tab after a key listener moved the focus to a sentinel', () => {
  function scene(stop: string) {
    root = document.body.appendChild(document.createElement('div'));
    root.innerHTML = `<input id="trigger" aria-label="Trigger"><input id="next" aria-label="Next"><span id="sentinel" tabindex="0"></span>${stop}<input id="end" aria-label="End">`;
    const trigger = root.querySelector<HTMLElement>('#trigger')!;
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') root!.querySelector<HTMLElement>('#sentinel')!.focus();
    });
    trigger.focus();
  }

  test('the browser moves the focus on from the sentinel', async () => {
    scene('<input id="stop" aria-label="Stop">');
    await userEvent.tab();
    expect(document.activeElement!.id).toBe('stop');
  });

  test('to a link: Chromium and Firefox; WebKit by the setting of the system, and always with Option', async () => {
    scene('<a id="stop" href="#stop">Stop</a>');
    await userEvent.tab();
    if (server.browser !== 'webkit') {
      expect(document.activeElement!.id).toBe('stop');
      return;
    }
    // WebKit on macOS skips a link unless the system setting says otherwise.
    expect(['stop', 'end']).toContain(document.activeElement!.id);
    root!.querySelector<HTMLElement>('#trigger')!.focus();
    await userEvent.keyboard('{Alt>}{Tab}{/Alt}');
    expect(document.activeElement!.id).toBe('stop');
  });
});

describe('a MutationObserver of new content', () => {
  test('runs before the paint: a size that its callback writes is the size of the next frame', async () => {
    root = document.body.appendChild(document.createElement('div'));
    root.innerHTML =
      '<div id="box" style="display: inline-block; width: var(--width, auto)"><div style="width: 100px"></div></div>';
    const box = root.querySelector<HTMLElement>('#box')!;
    const observer = new MutationObserver(() => box.style.setProperty('--width', '100px'));
    observer.observe(box, { childList: true, subtree: true });
    const sizes: number[] = [];
    box.append(Object.assign(document.createElement('div'), { style: 'width: 300px' }));
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => {
        sizes.push(box.offsetWidth);
        resolve();
      }),
    );
    observer.disconnect();
    expect(sizes).toEqual([100]);
  });
});

describe('the parts', () => {
  test('the classes of `transition` on a content, in each setup of the app', async () => {
    mount(NavigationMenuParts, {
      root: { defaultValue: 'one' },
      contents: { two: { transition: { name: 'slide' }, class: 'animated' } },
    });
    await nextTick();
    await waitFor(() => expect(get('content-one')).not.toHaveAttribute('hidden'));
    get('trigger-two').click();
    await nextTick();
    await waitFor(() => expect(get('content-two')).not.toBe(null));
    expect(get('content-two').className).toContain('slide-enter-active');
    await frame();
    await frame();
    expect(get('content-two').className).toContain('slide-enter-to');
  });

  test('200 fast opens, changes and closes give no size of zero, and the last size is that of the content', async () => {
    mount(NavigationMenuParts, { popup: { class: 'sized' } });
    await nextTick();
    const values = new Set<string>();
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const style = (record.target as HTMLElement).style;
        values.add(style.getPropertyValue('--popup-width'));
        values.add(style.getPropertyValue('--positioner-width'));
      }
    });
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['style'],
    });
    const order = ['trigger-one', 'trigger-two', 'trigger-two', 'trigger-one'];
    for (let index = 0; index < 200; index += 1) {
      get(order[index % order.length]!).click();
      await wait(index % 7);
    }
    await wait(20);
    get('trigger-two').click();
    get('trigger-one').click();
    await waitFor(() => expect(get('content-one')).not.toHaveAttribute('hidden'));
    await waitFor(() => expect(get('popup').style.getPropertyValue('--popup-width')).toBe(''));
    observer.disconnect();
    expect(values.has('0px')).toBe(false);
    expect(get('popup').offsetWidth).toBe(get('content-one').offsetWidth);
  });

  test.each([
    { name: 'mounts open', setup: { root: { defaultValue: 'one' } } },
    { name: 'is kept, and opens at another trigger', setup: { portal: { keepMounted: true } } },
  ])(
    'a positioner with a transition of its place that $name runs no transition',
    async ({ setup }) => {
      // The CSS of the demos: a transition of the place, with none while `data-instant` is on.
      const style = document.head.appendChild(document.createElement('style'));
      style.textContent =
        '.moving { transition: top 200ms, left 200ms } .moving[data-instant] { transition: none }';
      onTestFinished(() => style.remove());
      mount(NavigationMenuParts, { ...setup, positioner: { class: 'moving' } });
      await nextTick();
      if (!('root' in setup)) {
        get('trigger-one').click();
        await waitFor(() => expect(get('positioner')).not.toHaveAttribute('hidden'));
        await wait(250);
        get('trigger-one').click();
        await waitFor(() => expect(get('positioner')).toHaveAttribute('hidden'));
        get('trigger-two').click();
      }
      await waitFor(() => expect(get('positioner')).not.toHaveAttribute('hidden'));
      await waitFor(() => expect(get('positioner').style.visibility).toBe(''));
      for (let index = 0; index < 3; index += 1) {
        await frame();
        expect(get('positioner').getAnimations()).toEqual([]);
      }
    },
  );

  test('a kept, closed positioner with a size and a ::before takes no pointer', async () => {
    mount(NavigationMenuParts, {
      portal: { keepMounted: true },
      positioner: { class: 'demo-positioner' },
    });
    await nextTick();
    const style = document.head.appendChild(document.createElement('style'));
    style.textContent =
      '.demo-positioner { width: 200px; height: 100px } .demo-positioner::before { content: ""; position: absolute; inset: -10px }';
    try {
      await frame();
      const positioner = get('positioner');
      expect(positioner).toHaveAttribute('hidden');
      const rect = positioner.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + 5, rect.top + 5);
      expect(positioner.contains(hit)).toBe(false);
    } finally {
      style.remove();
    }
  });
});
