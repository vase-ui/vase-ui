import { afterEach, describe, expect, inject, onTestFinished, test, vi } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { h, nextTick, reactive, Teleport, watchEffect } from 'vue';
import type { UseToastManagerReturnValue } from '@vase-ui/vue/toast';
import PopoverParts from '../../test/fixtures/PopoverParts.vue';
import ToastAnchored from '../../test/fixtures/ToastAnchored.vue';
import ToastElementSlots from '../../test/fixtures/ToastElementSlots.vue';
import ToastLabelInTransition from '../../test/fixtures/ToastLabelInTransition.vue';
import ToastPartAlone from '../../test/fixtures/ToastPartAlone.vue';
import ToastParts from '../../test/fixtures/ToastParts.vue';
import { expectNoAxeViolations } from '../../test/axe';
import { mount, mountError } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

type Manager = UseToastManagerReturnValue<{ note?: string }>;
type Props = Record<string, unknown>;

const viewport = () => document.querySelector<HTMLElement>('[data-testid="viewport"]')!;
const toastRoot = (id: string) => document.querySelector<HTMLElement>(`[data-id="${id}"]`);
const byId = (id: string) => document.getElementById(id)!;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// A label that is a function gives vnodes. A Vapor app without the interop plugin renders no
// virtual DOM content in a part.
const rendersVnodes = inject('app') !== 'vapor';

async function mountToasts(props: Props = {}) {
  const { exposed, unmount } = mount(ToastParts, props);
  await nextTick();
  return { manager: exposed.manager as Manager, unmount };
}

/** Adds the toasts and waits for their roots. */
async function added(manager: Manager, ...toasts: Props[]) {
  for (const toast of toasts) manager.add({ timeout: 0, ...toast });
  await waitFor(() => {
    for (const toast of toasts) expect(toastRoot(toast.id as string)).not.toBe(null);
  });
}

/** Adds a `<style>` element to the document for the case. */
function style(css: string) {
  const element = document.head.appendChild(document.createElement('style'));
  element.textContent = css;
  onTestFinished(() => element.remove());
}

async function pressF6() {
  await userEvent.keyboard('{F6}');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('the parts', () => {
  test('render their elements with their roles; a template ref of the viewport has element; the attributes of the developer win', async () => {
    const { exposed } = mount(ToastParts, {
      list: { viewport: { 'aria-relevant': 'additions' }, root: { 'aria-modal': 'true' } },
    });
    await nextTick();
    const manager = exposed.manager as Manager;
    await added(manager, {
      id: 'a',
      title: 'Title',
      description: 'Description',
      actionProps: { children: 'Undo' },
    });
    const region = viewport();
    expect(region.localName).toBe('div');
    expect(region.parentElement).toBe(document.body);
    expect(region).toHaveAttribute('role', 'region');
    expect(region).toHaveAttribute('tabindex', '-1');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'false');
    expect(region).toHaveAttribute('aria-relevant', 'additions');
    const root = toastRoot('a')!;
    expect(root.localName).toBe('div');
    expect(root).toHaveAttribute('role', 'dialog');
    expect(root).toHaveAttribute('tabindex', '0');
    expect(root).toHaveAttribute('aria-modal', 'true');
    const title = root.querySelector('h2')!;
    const description = root.querySelector('p')!;
    expect(title).toHaveTextContent('Title');
    expect(description).toHaveTextContent('Description');
    expect(root).toHaveAttribute('aria-labelledby', title.id);
    expect(root).toHaveAttribute('aria-describedby', description.id);
    const [action, close] = root.querySelectorAll('button');
    expect(action).toHaveTextContent('Undo');
    expect(action).toHaveAttribute('type', 'button');
    expect(close).toHaveTextContent('Close');
    expect(close).toHaveAttribute('type', 'button');
    await expectNoAxeViolations(region, { rules: { region: { enabled: false } } });
  });

  test('render the tag of `as`; a button part on another tag is a button with a tab stop and no `type`', async () => {
    const { manager } = await mountToasts({
      list: { root: { as: 'section' }, close: { as: 'span' }, title: { as: 'h3' } },
    });
    await added(manager, { id: 'a', title: 'Title' });
    const root = toastRoot('a')!;
    expect(root.localName).toBe('section');
    expect(root.querySelector('h3')).toHaveTextContent('Title');
    const close = root.querySelector('span[role="button"]')!;
    expect(close).toHaveAttribute('tabindex', '0');
    expect(close).not.toHaveAttribute('type');
  });

  test('the `element` slot renders the element of the developer with the props; the sentinels of the viewport are beside it', async () => {
    mount(ToastElementSlots);
    await waitFor(() => expect(toastRoot('a')).not.toBe(null));
    const region = document.querySelector<HTMLElement>('section[role="region"]')!;
    const root = toastRoot('a')!;
    expect(root.localName).toBe('article');
    expect(root).toHaveAttribute('role', 'dialog');
    expect(root).toHaveAttribute('aria-labelledby', root.querySelector('h2')!.id);
    expect(region).toHaveAttribute('data-expanded-state', 'false');
    byId('toast-before').focus();
    await pressF6();
    expect(document.activeElement).toBe(region);
    expect(region.previousElementSibling).toHaveAttribute('tabindex', '0');
    expect(region.nextElementSibling).toHaveAttribute('tabindex', '0');
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(root);
  });
});

describe('the list (B1)', () => {
  test('add gives the id; a new id has the prefix of the library; the newest toast is first', async () => {
    const { manager } = await mountToasts();
    const first = manager.add({ title: 'One' });
    const second = manager.add({ title: 'Two' });
    expect(first).toMatch(/^vase-ui-toast-\d+$/);
    expect(second).not.toBe(first);
    expect(manager.toasts.value.map((toast) => toast.id)).toEqual([second, first]);
  });

  test('an add with the id of an open toast updates that toast and counts the update; a generated id does not update a toast with the id `toast-1`', async () => {
    const { manager } = await mountToasts();
    manager.add({ id: 'toast-1', title: 'Mine' });
    const generated = manager.add({ title: 'Generated' });
    expect(generated).not.toBe('toast-1');
    expect(manager.add({ id: 'toast-1', title: 'Again' })).toBe('toast-1');
    expect(manager.toasts.value).toHaveLength(2);
    const mine = manager.toasts.value.find((toast) => toast.id === 'toast-1')!;
    expect(mine.title).toBe('Again');
    expect(mine.updateKey).toBe(1);
  });

  test('update replaces each given value and `data` as a whole; a function gets the toast; an id that is not open changes nothing and calls no function', async () => {
    const { manager } = await mountToasts();
    manager.add({ id: 'a', title: 'One', description: 'Kept', data: { note: 'first' } });
    manager.update('a', { title: 'Two', data: {} });
    expect(manager.toasts.value[0]).toMatchObject({
      title: 'Two',
      description: 'Kept',
      data: {},
      updateKey: 1,
    });
    manager.update('a', (toast) => ({ title: `${String(toast.title)}!` }));
    expect(manager.toasts.value[0]!.title).toBe('Two!');
    const updater = vi.fn(() => ({}));
    manager.update('missing', updater);
    expect(updater).not.toHaveBeenCalled();
    expect(manager.toasts.value).toHaveLength(1);
  });

  test('a measure of an unchanged height gives no new list', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    await waitFor(() => expect(manager.toasts.value[0]!.height).toBeGreaterThan(0));
    const before = manager.toasts.value;
    toastRoot('a')!.querySelector('h2')!.textContent = 'A';
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await nextTick();
    expect(manager.toasts.value).toBe(before);
  });

  test('each change gives a new object and a new array; a toast that does not change keeps its object; a height counts no update', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' }, { id: 'b', title: 'B' });
    await waitFor(() => expect(manager.toasts.value.every((toast) => toast.height)).toBe(true));
    const before = manager.toasts.value;
    manager.update('b', { title: 'B2' });
    const after = manager.toasts.value;
    expect(after).not.toBe(before);
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(after.map((toast) => toast.updateKey)).toEqual([1, 0]);
  });

  test('close(id) removes the toast and calls its onClose one time; close() closes each toast; an id that is not open does nothing', async () => {
    const { manager } = await mountToasts();
    const log: string[] = [];
    for (const id of ['a', 'b', 'c']) manager.add({ id, onClose: () => log.push(id) });
    manager.close('b');
    manager.close('b');
    manager.close('missing');
    expect(manager.toasts.value.map((toast) => toast.id)).toEqual(['c', 'a']);
    manager.close();
    expect(manager.toasts.value).toEqual([]);
    expect(log).toEqual(['b', 'c', 'a']);
  });

  test('`limit` makes each toast over it `limited`, and its root inert; a change of the limit holds at once', async () => {
    const provider = reactive<Props>({ limit: 2 });
    const { manager } = await mountToasts({ provider });
    await added(manager, { id: 'a' }, { id: 'b' }, { id: 'c' });
    expect(manager.toasts.value.map((toast) => toast.limited)).toEqual([false, false, true]);
    expect(toastRoot('a')).toHaveAttribute('inert');
    expect(toastRoot('c')).not.toHaveAttribute('inert');
    provider.limit = 3;
    await nextTick();
    expect(manager.toasts.value.map((toast) => toast.limited)).toEqual([false, false, false]);
    expect(toastRoot('a')).not.toHaveAttribute('inert');
  });

  test('an effect that calls a method does not run again when the list changes', async () => {
    const { manager } = await mountToasts();
    let runs = 0;
    const stop = watchEffect(() => {
      runs += 1;
      manager.add({ id: 'effect' });
      manager.update('effect', { title: 'Effect' });
      manager.close('other');
    });
    onTestFinished(stop);
    manager.add({ id: 'later' });
    await nextTick();
    expect(runs).toBe(1);
  });

  test('promise shows a loading toast and then the toast of the result; a text is the description; `promise` gives the value', async () => {
    const { manager } = await mountToasts();
    let resolve!: (value: string) => void;
    const result = manager.promise(new Promise<string>((done) => (resolve = done)), {
      loading: 'Saving',
      success: (value) => ({ title: `Saved ${value}`, description: 'Done' }),
      error: 'Failed',
    });
    expect(manager.toasts.value[0]).toMatchObject({ type: 'loading', description: 'Saving' });
    resolve('file');
    await expect(result).resolves.toBe('file');
    expect(manager.toasts.value[0]).toMatchObject({
      type: 'success',
      title: 'Saved file',
      description: 'Done',
    });
  });
});

describe('the timers (B2)', () => {
  function fakeTimers() {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  }

  async function advance(ms: number) {
    vi.advanceTimersByTime(ms);
    await nextTick();
  }

  test('a toast closes after its timeout, else the timeout of the provider; `0` and the type `loading` keep it open', async () => {
    const { manager } = await mountToasts({ provider: { timeout: 1000 } });
    fakeTimers();
    manager.add({ id: 'own', timeout: 500 });
    manager.add({ id: 'provider' });
    manager.add({ id: 'zero', timeout: 0 });
    manager.add({ id: 'loading', type: 'loading', timeout: 100 });
    await advance(600);
    expect(manager.toasts.value.map((toast) => toast.id)).toEqual(['loading', 'zero', 'provider']);
    await advance(500);
    expect(manager.toasts.value.map((toast) => toast.id)).toEqual(['loading', 'zero']);
  });

  test('the hover of the viewport stops the timers with the time that is left; a toast that comes in the hover waits', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    fakeTimers();
    // A command of `vitest/browser` moves the fake clock while it runs, so the times are long.
    manager.update('a', { timeout: 10000 });
    await advance(4000);
    await userEvent.hover(toastRoot('a')!);
    await waitFor(() => expect(viewport()).toHaveAttribute('data-expanded'));
    manager.add({ id: 'b', title: 'B', timeout: 2000 });
    await advance(20000);
    expect(manager.toasts.value).toHaveLength(2);
    await userEvent.pointer({ coords: { x: 0, y: 0 } });
    await waitFor(() => expect(viewport()).not.toHaveAttribute('data-expanded'));
    await advance(2500);
    expect(manager.toasts.value.map((toast) => toast.id)).toEqual(['a']);
    await advance(6000);
    expect(manager.toasts.value).toEqual([]);
  });

  test('an update starts the full time again with a `timeout` key or at the end of the loading state; another update leaves the timer', async () => {
    const { manager } = await mountToasts();
    fakeTimers();
    manager.add({ id: 'a', timeout: 1000 });
    manager.add({ id: 'b', type: 'loading' });
    await advance(600);
    manager.update('a', { title: 'Other' });
    await advance(500);
    expect(manager.toasts.value.map((toast) => toast.id)).toEqual(['b']);
    manager.add({ id: 'a', timeout: 1000 });
    await advance(600);
    manager.update('a', { timeout: 1000 });
    manager.update('b', { type: 'success', timeout: 1000 });
    await advance(600);
    expect(manager.toasts.value.map((toast) => toast.id)).toEqual(['a', 'b']);
    await advance(500);
    expect(manager.toasts.value).toEqual([]);
  });

  test('a keyboard focus in the viewport stops the timers; a press with the mouse does not', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    await userEvent.click(toastRoot('a')!, { position: { x: 2, y: 2 } });
    await userEvent.pointer({ coords: { x: 0, y: 0 } });
    await waitFor(() => expect(viewport()).not.toHaveAttribute('data-expanded'));
    expect(toastRoot('a')!.contains(document.activeElement)).toBe(true);
    byId('toast-before').focus();
    await pressF6();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(toastRoot('a'));
    await waitFor(() => expect(viewport()).toHaveAttribute('data-expanded'));
    fakeTimers();
    manager.update('a', { timeout: 100 });
    await advance(500);
    expect(manager.toasts.value).toHaveLength(1);
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(byId('toast-before'));
    await advance(150);
    expect(manager.toasts.value).toEqual([]);
  });

  test('a `blur` of the window stops the timers, and its `focus` starts them; BUG-6174: the focus that goes into a frame of the page keeps them', async () => {
    const { manager } = await mountToasts();
    const frame = document.body.appendChild(document.createElement('iframe'));
    frame.title = 'Frame';
    frame.srcdoc = '<button id="inner">Inner</button>';
    onTestFinished(() => frame.remove());
    await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
    await added(manager, { id: 'a', title: 'A' });
    window.dispatchEvent(new FocusEvent('blur'));
    manager.update('a', { timeout: 100 });
    await wait(300);
    expect(manager.toasts.value).toHaveLength(1);
    window.dispatchEvent(new FocusEvent('focus'));
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
    await added(manager, { id: 'b', title: 'B' });
    byId('toast-before').focus();
    frame.contentDocument!.getElementById('inner')!.focus();
    manager.update('b', { timeout: 100 });
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
  });

  test('BUG-6174: a hidden page stops the timers; VUE-76: a page that is hidden at the mount starts with them stopped', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    onTestFinished(() => visibility.mockRestore());
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    manager.update('a', { timeout: 100 });
    await wait(300);
    expect(manager.toasts.value).toHaveLength(1);
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
    await added(manager, { id: 'b', title: 'B' });
    visibility.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    manager.update('b', { timeout: 100 });
    await wait(300);
    expect(manager.toasts.value).toHaveLength(1);
  });

  test.skipIf(server.browser !== 'chromium')(
    'a touch outside the viewport ends the hover and the focus state',
    async () => {
      const { touchDrag } = await import('../../test/pointer');
      const { manager } = await mountToasts();
      await added(manager, { id: 'a', title: 'A' });
      const rect = toastRoot('a')!.getBoundingClientRect();
      await touchDrag(
        { x: rect.left + 4, y: rect.top + 4 },
        { x: rect.left + 4, y: rect.top + 4 },
        0,
      );
      await waitFor(() => expect(viewport()).toHaveAttribute('data-expanded'));
      // A touch that scrolls the page sends no `mouseleave` (test/measurements/toast.test.ts).
      const page = document.body.appendChild(document.createElement('div'));
      page.style.height = '3000px';
      onTestFinished(() => page.remove());
      const outside = byId('toast-before').getBoundingClientRect();
      const start = { x: outside.left + 2, y: outside.top + 2 };
      await touchDrag(start, { x: start.x, y: start.y - 100 }, 10);
      await waitFor(() => expect(viewport()).not.toHaveAttribute('data-expanded'));
    },
  );
});

describe('enter and leave (B3)', () => {
  const LEAVE = '.toast-leave-active { transition: opacity 200ms } .toast-leave-to { opacity: 0 }';

  test('a root in a <TransitionGroup> gets the leave classes at a close, and `onRemove` comes after the leave', async () => {
    style(LEAVE);
    const { manager } = await mountToasts();
    const log: string[] = [];
    await added(manager, {
      id: 'a',
      title: 'A',
      onClose: () => log.push('close'),
      onRemove: () => log.push('remove'),
    });
    const root = toastRoot('a')!;
    manager.close('a');
    await nextTick();
    expect(root.className).toContain('toast-leave-active');
    expect(manager.toasts.value).toEqual([]);
    expect(log).toEqual(['close']);
    await waitFor(() => expect(log).toEqual(['close', 'remove']));
    expect(root.isConnected).toBe(false);
  });

  test('with no transition, `onRemove` comes when the element is gone', async () => {
    const { manager } = await mountToasts();
    const onRemove = vi.fn();
    await added(manager, { id: 'a', onRemove });
    manager.close('a');
    await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(1));
    expect(toastRoot('a')).toBe(null);
  });

  test('an add with the id of a toast in its leave makes a new toast: one element, with no class at the end; the old toast gets no `onRemove`', async () => {
    style(
      `${LEAVE} .toast-enter-active { transition: opacity 200ms } .toast-enter-from { opacity: 0 }`,
    );
    const { manager } = await mountToasts();
    const onRemove = vi.fn();
    await added(manager, { id: 'a', title: 'A', onRemove });
    await wait(250);
    manager.close('a');
    await nextTick();
    manager.add({ id: 'a', title: 'Again', timeout: 0 });
    await nextTick();
    await wait(300);
    const roots = document.querySelectorAll('[data-id="a"]');
    expect(roots).toHaveLength(1);
    expect(roots[0]!.className).toBe('');
    expect(roots[0]).toHaveTextContent('Again');
    expect(onRemove).not.toHaveBeenCalled();
  });

  test('N5: with JavaScript hooks, `onRemove` and the end of the held leave come after `done`', async () => {
    let finish!: () => void;
    const { manager } = await mountToasts({
      list: {
        group: { css: false, onLeave: (_: Element, done: () => void) => (finish = done) },
      },
    });
    const onRemove = vi.fn();
    await added(manager, { id: 'a', onRemove });
    manager.close('a');
    await wait(100);
    expect(onRemove).not.toHaveBeenCalled();
    expect(toastRoot('a')).not.toBe(null);
    finish();
    await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(1));
  });
});

describe('the stack (B4)', () => {
  test('writes the index, the offset, the natural height of each toast and the height of the front toast; a toast behind has `data-behind`', async () => {
    // A style that gives each toast the height of the front toast changes no measure.
    style('[data-id] { height: var(--toast-frontmost-height, 10px) }');
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' }, { id: 'b', title: 'B', description: 'More' });
    const front = toastRoot('b')!;
    const back = toastRoot('a')!;
    await waitFor(() => expect(manager.toasts.value[1]!.height).toBeGreaterThan(0));
    const [frontHeight, backHeight] = manager.toasts.value.map((toast) => `${toast.height}px`);
    expect(frontHeight).not.toBe(backHeight);
    expect(back.style.getPropertyValue('--toast-offset-y')).toBe(frontHeight);
    expect(front.style.getPropertyValue('--toast-index')).toBe('0');
    expect(back.style.getPropertyValue('--toast-index')).toBe('1');
    expect(front.style.getPropertyValue('--toast-offset-y')).toBe('0px');
    expect(front.style.getPropertyValue('--toast-height')).toBe(frontHeight);
    expect(back.style.getPropertyValue('--toast-height')).toBe(backHeight);
    expect(viewport().style.getPropertyValue('--toast-frontmost-height')).toBe(frontHeight);
    expect(back.querySelector('[data-testid="content"]')).toHaveAttribute('data-behind');
    expect(front.querySelector('[data-testid="content"]')).not.toHaveAttribute('data-behind');
    manager.close('b');
    await nextTick();
    expect(back.style.getPropertyValue('--toast-index')).toBe('0');
    expect(back.style.getPropertyValue('--toast-offset-y')).toBe('0px');
  });

  test('measures the natural height again when the content changes, also in a root with a fixed height (T7)', async () => {
    style(
      '[data-id] { height: 20px; overflow: hidden } [data-id] [data-testid="content"] { height: 100% }',
    );
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', description: 'Short' });
    await waitFor(() => expect(manager.toasts.value[0]!.height).toBeGreaterThan(0));
    // The resize observer measures once after its start.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const first = manager.toasts.value[0]!.height!;
    manager.update('a', { description: 'A longer text\nthat wraps on more lines '.repeat(20) });
    await waitFor(() => expect(manager.toasts.value[0]!.height).toBeGreaterThan(first));
    expect(manager.toasts.value[0]!.updateKey).toBe(1);
  });
});

describe('hover, focus and the window (B5)', () => {
  test('the stack stays expanded from a close under the pointer to the end of the leave', async () => {
    style('.toast-leave-active { transition: opacity 300ms } .toast-leave-to { opacity: 0 }');
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' }, { id: 'b', title: 'B' });
    await userEvent.hover(toastRoot('b')!);
    await waitFor(() => expect(viewport()).toHaveAttribute('data-expanded'));
    const leaving = toastRoot('b')!;
    manager.close('b');
    await userEvent.pointer({ coords: { x: 0, y: 0 } });
    expect(leaving.isConnected).toBe(true);
    expect(viewport()).toHaveAttribute('data-expanded');
    await waitFor(() => expect(leaving.isConnected).toBe(false));
    await waitFor(() => expect(viewport()).not.toHaveAttribute('data-expanded'));
  });

  test('the hover ends when the toast under the pointer leaves the document', async () => {
    // As in the demos, the viewport has no height, the toasts are absolute, and a toast leaves with
    // a transition. The older toast is the lower one, so no toast is under the pointer after its
    // close. The pointer rests on the root itself, not on its content.
    style(
      '[data-testid="viewport"] { position: fixed; top: 200px; left: 200px; width: 200px; height: 0 } [data-id] { position: absolute; left: 0; width: 200px; padding: 10px } [data-id="a"] { top: 400px } [data-id="b"] { top: 0 } .toast-leave-active { transition: opacity 100ms } .toast-leave-to { opacity: 0 }',
    );
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' }, { id: 'b', title: 'B' });
    await userEvent.hover(toastRoot('a')!, { position: { x: 2, y: 2 } });
    await waitFor(() => expect(viewport()).toHaveAttribute('data-expanded'));
    const leaving = toastRoot('a')!;
    manager.close('a');
    await waitFor(() => expect(leaving.isConnected).toBe(false));
    // The pointer rests. WebKit then sends no `mouseleave` (test/measurements/toast.test.ts).
    await waitFor(() => expect(viewport()).not.toHaveAttribute('data-expanded'));
  });

  test.each(['a blur of the window', 'a keyboard focus in a toast'])(
    'the timers run in a new viewport after the old one unmounts with %s',
    async (state) => {
      const list = reactive<Props>({ withoutViewport: false });
      const { manager } = await mountToasts({ list });
      await added(manager, { id: 'a', title: 'A' });
      if (state === 'a blur of the window') {
        window.dispatchEvent(new FocusEvent('blur'));
      } else {
        byId('toast-before').focus();
        await pressF6();
        await userEvent.keyboard('{Tab}');
        expect(document.activeElement).toBe(toastRoot('a'));
      }
      list.withoutViewport = true;
      await waitFor(() => expect(toastRoot('a')).toBe(null));
      list.withoutViewport = false;
      await waitFor(() => expect(toastRoot('a')).not.toBe(null));
      manager.update('a', { timeout: 100 });
      await waitFor(() => expect(toastRoot('a')).toBe(null));
    },
  );

  test('the hover ends when the last toast closes, also while the toast leaves under the pointer', async () => {
    style('.toast-leave-active { transition: opacity 300ms } .toast-leave-to { opacity: 0 }');
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    await userEvent.hover(toastRoot('a')!);
    await waitFor(() => expect(viewport()).toHaveAttribute('data-expanded'));
    const leaving = toastRoot('a')!;
    manager.close('a');
    await nextTick();
    expect(leaving.isConnected).toBe(true);
    expect(viewport()).not.toHaveAttribute('data-expanded');
  });
});

describe('the keys (B6)', () => {
  test('F6 moves the focus to the viewport; F6 in it returns the focus to its origin', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    byId('toast-before').focus();
    await pressF6();
    expect(document.activeElement).toBe(viewport());
    expect(viewport().matches(':focus-visible')).toBe(true);
    await pressF6();
    expect(document.activeElement).toBe(byId('toast-before'));
  });

  test('F6 does nothing with no toast, or when a listener prevented it', async () => {
    // A real F6 with no toast moves the focus out of the page in Firefox.
    const f6 = () =>
      byId('toast-before').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true }),
      );
    const { manager } = await mountToasts();
    byId('toast-before').focus();
    f6();
    expect(document.activeElement).toBe(byId('toast-before'));
    await added(manager, { id: 'a', title: 'A' });
    const prevent = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener('keydown', prevent);
    onTestFinished(() => document.removeEventListener('keydown', prevent));
    f6();
    expect(document.activeElement).toBe(byId('toast-before'));
    document.removeEventListener('keydown', prevent);
    f6();
    expect(document.activeElement).toBe(viewport());
  });

  test('F6 in a toast with no origin stays with the browser: no listener of the window takes the focus', async () => {
    const { manager } = await mountToasts({ inPlace: true });
    await added(manager, { id: 'a', title: 'A' });
    byId('toast-before').focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(toastRoot('a'));
    // A real F6 moves the focus out of the page in Firefox.
    toastRoot('a')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(toastRoot('a'));
  });

  test('Tab from the viewport goes to the first toast that is not inert; Shift+Tab on the first toast and Tab after the last return the focus to the origin', async () => {
    const { manager } = await mountToasts({
      provider: { limit: 2 },
      list: { close: { as: 'span' } },
    });
    await added(manager, { id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' });
    byId('toast-before').focus();
    await pressF6();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(toastRoot('c'));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(byId('toast-before'));
    await pressF6();
    await userEvent.keyboard('{Tab}{Tab}{Tab}{Tab}');
    expect(document.activeElement).toBe(toastRoot('b')!.querySelector('[role="button"]'));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byId('toast-before'));
  });

  test('Shift+Tab on the viewport returns the focus to the origin; with no origin the browser keeps the key', async () => {
    const { manager } = await mountToasts({ inPlace: true });
    await added(manager, { id: 'a', title: 'A' });
    byId('toast-after').focus();
    await pressF6();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(byId('toast-after'));
    viewport().focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(byId('toast-before'));
  });

  test('a return to <body> as the origin takes the focus out of the viewport', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    (document.activeElement as HTMLElement | null)?.blur();
    await pressF6();
    expect(document.activeElement).toBe(viewport());
    await pressF6();
    expect(document.activeElement).toBe(document.body);
  });

  test('VUE-127: Escape in a toast closes it, and a popup under it gets no Escape', async () => {
    const log: string[] = [];
    mount(PopoverParts, {
      root: {
        open: true,
        onOpenChange: (_: boolean, details: { reason: string }) => log.push(details.reason),
      },
    });
    // The popup takes the focus after its first placement.
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-testid', 'first'));
    // With no F6 the viewport has no origin, so only the root stops the Escape.
    const { manager } = await mountToasts({ inPlace: true });
    await added(manager, { id: 'a', title: 'A' }, { id: 'b', title: 'B' });
    byId('toast-before').focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(toastRoot('b'));
    await userEvent.keyboard('{Escape}');
    expect(manager.toasts.value.map((toast) => toast.id)).toEqual(['a']);
    expect(log).not.toContain('escape-key');
  });

  test('VUE-130: Escape in the viewport that no toast took returns the focus to the origin, and a popup under it gets no Escape', async () => {
    const log: string[] = [];
    mount(PopoverParts, {
      root: {
        open: true,
        onOpenChange: (_: boolean, details: { reason: string }) => log.push(details.reason),
      },
    });
    // The popup takes the focus after its first placement.
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-testid', 'first'));
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    byId('toast-before').focus();
    await pressF6();
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(byId('toast-before'));
    expect(manager.toasts.value).toHaveLength(1);
    expect(log).not.toContain('escape-key');
  });

  test('an Escape of a text composition closes nothing', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    toastRoot('a')!.focus();
    toastRoot('a')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true }),
    );
    expect(manager.toasts.value).toHaveLength(1);
  });

  test.runIf(rendersVnodes)(
    'an Escape in content that a <Teleport> of the toast moves out of it closes nothing',
    async () => {
      const { manager } = await mountToasts();
      await added(manager, {
        id: 'a',
        description: () =>
          h(Teleport, { to: 'body' }, h('input', { id: 'moved', 'aria-label': 'Moved' })),
      });
      byId('moved').focus();
      await userEvent.keyboard('{Escape}');
      expect(manager.toasts.value).toHaveLength(1);
    },
  );

  test('a close with a keyboard focus in the toast moves it to the next older toast that is not inert, else to the next newer one, else to the origin', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' });
    byId('toast-before').focus();
    await pressF6();
    await userEvent.keyboard('{Tab}');
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(toastRoot('b'));
    expect(toastRoot('b')!.matches(':focus-visible')).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(toastRoot('a'));
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(byId('toast-before'));
  });

  test('a close moves the focus to the next newer toast when no older toast can take it, and close() returns it to the origin', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' }, { id: 'b', title: 'B' });
    byId('toast-before').focus();
    await pressF6();
    await userEvent.keyboard('{Tab}{Shift>}{Tab}{/Shift}');
    await pressF6();
    toastRoot('a')!.focus();
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(toastRoot('b'));
    manager.close();
    expect(document.activeElement).toBe(byId('toast-before'));
  });

  test('with `limit` 1, Escape on the newest toast that Tab focused ends the focus state, and the time of the other toast runs', async () => {
    const { manager } = await mountToasts({ provider: { limit: 1 }, inPlace: true });
    await added(manager, { id: 'a', title: 'A' }, { id: 'b', title: 'B' });
    byId('toast-before').focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(toastRoot('b'));
    await waitFor(() => expect(viewport()).toHaveAttribute('data-expanded'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(viewport()).not.toHaveAttribute('data-expanded'));
    manager.update('a', { timeout: 100 });
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
  });

  test('a close ends the focus state when the origin cannot take the focus', async () => {
    const { manager } = await mountToasts({ provider: { limit: 1 } });
    await added(manager, { id: 'a', title: 'A' }, { id: 'b', title: 'B' });
    const origin = byId('toast-before') as HTMLInputElement;
    origin.focus();
    await pressF6();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(toastRoot('b'));
    await waitFor(() => expect(viewport()).toHaveAttribute('data-expanded'));
    origin.disabled = true;
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(viewport()).not.toHaveAttribute('data-expanded'));
    manager.update('a', { timeout: 100 });
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
  });
});

describe('the names and the announcements (B7)', () => {
  test('VUE-56: the root names its last title; when that title goes, the one that stays; a default slot is content', async () => {
    const list = reactive<Props>({ titleText: 'Slot title', secondTitle: true });
    const { manager } = await mountToasts({ list });
    await added(manager, { id: 'a', description: 'Description' });
    const root = toastRoot('a')!;
    const [first, second] = root.querySelectorAll('h2');
    expect(first).toHaveTextContent('Slot title');
    expect(second).toHaveTextContent('Second');
    expect(root).toHaveAttribute('aria-labelledby', second!.id);
    list.secondTitle = false;
    await nextTick();
    expect(root).toHaveAttribute('aria-labelledby', first!.id);
  });

  test('VUE-99: a toast with no title takes the name of its description; a name of the developer wins', async () => {
    const root = reactive<Props>({});
    const { manager } = await mountToasts({ list: { root } });
    await added(manager, { id: 'a', description: 'Saved' });
    const element = toastRoot('a')!;
    const description = element.querySelector('p')!;
    expect(element).toHaveAttribute('aria-labelledby', description.id);
    expect(element).not.toHaveAttribute('aria-describedby');
    root['aria-label'] = 'File';
    await nextTick();
    expect(element).toHaveAttribute('aria-label', 'File');
    expect(element).not.toHaveAttribute('aria-labelledby');
    expect(element).toHaveAttribute('aria-describedby', description.id);
    manager.update('a', { title: 'Title' });
    await nextTick();
    expect(element).toHaveAttribute('aria-labelledby', element.querySelector('h2')!.id);
  });

  test.each([
    { name: 'a text', label: 'Text', shown: true },
    { name: '0', label: 0, shown: true },
    { name: 'an empty text', label: '', shown: false },
    { name: 'null', label: null, shown: false },
    { name: 'a Boolean', label: true, shown: false },
  ])(
    'a title, a description and an action with $name as the label render: $shown',
    async ({ label, shown }) => {
      const { manager } = await mountToasts();
      await added(manager, {
        id: 'a',
        title: label,
        description: label,
        actionProps: { children: label },
      });
      const root = toastRoot('a')!;
      expect(!!root.querySelector('h2')).toBe(shown);
      expect(!!root.querySelector('p')).toBe(shown);
      expect(root.querySelectorAll('button')).toHaveLength(shown ? 2 : 1);
      if (shown) expect(root.querySelector('h2')).toHaveTextContent(String(label));
    },
  );

  test.runIf(rendersVnodes)(
    'a label that is a function renders as a component; `actionProps` gives the attributes and the listeners of the action',
    async () => {
      const onClick = vi.fn();
      const { manager } = await mountToasts();
      await added(manager, {
        id: 'a',
        title: () => h('strong', 'Bold'),
        actionProps: { children: 'Undo', onClick, 'aria-label': 'Undo the change' },
      });
      const root = toastRoot('a')!;
      expect(root.querySelector('h2 > strong')).toHaveTextContent('Bold');
      const action = root.querySelector('button')!;
      expect(action).toHaveAttribute('aria-label', 'Undo the change');
      await userEvent.click(action);
      expect(onClick).toHaveBeenCalledTimes(1);
    },
  );

  test('a slot that comes after the mount is content', async () => {
    const list = reactive<Props>({ titleText: '' });
    const { manager } = await mountToasts({ list });
    await added(manager, { id: 'a', description: 'Description' });
    const root = toastRoot('a')!;
    expect(root.querySelector('h2')).toBe(null);
    list.titleText = 'Later';
    await nextTick();
    expect(root.querySelector('h2')).toHaveTextContent('Later');
    expect(root).toHaveAttribute('aria-labelledby', root.querySelector('h2')!.id);
  });

  test('in a <Transition>, a description that shows during its leave renders one element at each moment; the new element enters after the old one goes, and the root names it', async () => {
    const { exposed } = mount(ToastLabelInTransition);
    await nextTick();
    const manager = exposed.manager as Manager;
    await added(manager, { id: 'a', description: 'Old' });
    const root = toastRoot('a')!;
    const descriptions = () => [...root.querySelectorAll('p')];
    const [old] = descriptions();
    let most = 0;
    const observer = new MutationObserver(() => (most = Math.max(most, descriptions().length)));
    observer.observe(root, { childList: true });
    manager.update('a', { description: '' });
    await nextTick();
    manager.update('a', { description: 'New' });
    await nextTick();
    expect(descriptions()).toEqual([old]);
    await waitFor(() => {
      expect(descriptions()).toHaveLength(1);
      expect(descriptions()[0]).not.toBe(old);
      expect(descriptions()[0]!.className).toBe('');
    });
    observer.disconnect();
    expect(most).toBe(1);
    expect(descriptions()[0]).toHaveTextContent('New');
    expect(root).toHaveAttribute('aria-labelledby', descriptions()[0]!.id);
  });

  test('VUE-93: an empty `id` counts as none', async () => {
    const { manager } = await mountToasts({ list: { title: { id: '' } } });
    await added(manager, { id: 'a', title: 'Title' });
    const title = toastRoot('a')!.querySelector('h2')!;
    expect(title.id).not.toBe('');
    expect(toastRoot('a')).toHaveAttribute('aria-labelledby', title.id);
  });

  test('a toast of high priority is an `alertdialog`, hidden from a screen reader until the focus comes; an alert in the parent of the viewport announces it', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'Alert', description: 'Now', priority: 'high' });
    const root = toastRoot('a')!;
    expect(root).toHaveAttribute('role', 'alertdialog');
    expect(root).toHaveAttribute('aria-hidden', 'true');
    await waitFor(() => expect(document.querySelector('[role="alert"]')).not.toBe(null));
    const alert = document.querySelector('[role="alert"]')!;
    expect(alert.parentElement).toBe(viewport().parentElement);
    expect(alert).toHaveAttribute('aria-atomic', 'true');
    expect(alert.textContent).toBe('AlertNow');
    byId('toast-before').focus();
    await pressF6();
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(root).not.toHaveAttribute('aria-hidden'));
    expect(document.querySelector('[role="alert"]')).toBe(null);
  });

  test('Close has `aria-hidden` while the stack is collapsed and the button has no focus', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    const close = toastRoot('a')!.querySelector('button')!;
    expect(close).toHaveAttribute('aria-hidden', 'true');
    close.focus();
    await nextTick();
    expect(close).not.toHaveAttribute('aria-hidden');
  });

  test('under a modal popup, a viewport deep in the application has no inert ancestor, and the rest of the application is inert', async () => {
    const { manager } = await mountToasts({ inPlace: true });
    await added(manager, { id: 'a', title: 'A' });
    const { exposed } = mount(PopoverParts, {
      root: { modal: true, defaultOpen: true },
      close: {},
    });
    expect(exposed).toBeTruthy();
    await waitFor(() => expect(byId('toast-before')).toHaveAttribute('inert'));
    expect(viewport().closest('[inert]')).toBe(null);
  });

  test('an alert that comes while a modal popup is open has no inert ancestor, also after a second popup opens', async () => {
    const { manager } = await mountToasts();
    mount(PopoverParts, { root: { modal: true, defaultOpen: true }, close: {}, nested: {} });
    await waitFor(() => expect(byId('toast-before').closest('[inert]')).not.toBe(null));
    await added(manager, { id: 'a', title: 'Alert', priority: 'high' });
    await waitFor(() => expect(document.querySelector('[role="alert"]')).not.toBe(null));
    const alert = document.querySelector('[role="alert"]')!;
    expect(alert.closest('[inert]')).toBe(null);
    await userEvent.click(document.querySelector('[data-key="nested"]')!);
    await waitFor(() =>
      expect(document.querySelector('[data-testid="nested-popup"]')).not.toBe(null),
    );
    await nextTick();
    expect(alert.closest('[inert]')).toBe(null);
    expect(viewport().closest('[inert]')).toBe(null);
  });
});

describe('anchored toasts (B9)', () => {
  test('the positioner places the toast at the anchor of `positionerProps`; a prop of the part wins; the default side is `top`; `class` and `style` of the toast are under those of the developer', async () => {
    const positioner = reactive<Props>({ class: 'mine', style: { zIndex: 2 } });
    const { exposed } = mount(ToastAnchored, { positioner });
    await nextTick();
    const manager = exposed.manager as Manager;
    manager.add({
      id: 'a',
      description: 'Copied',
      timeout: 0,
      positionerProps: {
        anchor: byId('anchor'),
        sideOffset: 8,
        class: 'theirs',
        style: { zIndex: 1, color: 'red' },
      },
    });
    const element = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-testid="positioner"]');
      expect(found?.style.visibility).toBe('');
      return found!;
    });
    expect(element).toHaveAttribute('data-side', 'top');
    expect(element).toHaveAttribute('data-align', 'center');
    expect(element.className).toMatch(/^theirs mine\b/);
    expect(element.style.zIndex).toBe('2');
    expect(element.style.color).toBe('red');
    expect(element.style.getPropertyValue('--toast-index')).toBe('0');
    const anchor = byId('anchor').getBoundingClientRect();
    expect(Math.round(element.getBoundingClientRect().bottom)).toBe(Math.round(anchor.top - 8));
    expect(document.querySelector('[data-testid="arrow"]')).toHaveAttribute('data-side', 'top');
    positioner.side = 'bottom';
    await waitFor(() => expect(element).toHaveAttribute('data-side', 'bottom'));
    expect(toastRoot('a')!.style.touchAction).toBe('');
  });

  test('with no anchor, the positioner renders with its default side and alignment', async () => {
    const { exposed } = mount(ToastAnchored);
    await nextTick();
    (exposed.manager as Manager).add({ id: 'a', description: 'Free', positionerProps: {} });
    const element = await waitFor(() => {
      const found = document.querySelector('[data-testid="positioner"]');
      expect(found).not.toBe(null);
      return found!;
    });
    expect(element).toHaveAttribute('data-side', 'top');
    expect(element).toHaveAttribute('data-align', 'center');
  });

  test('a positioner in a <TransitionGroup> with `duration` keeps its root while the root animates', async () => {
    style(
      '.toast-leave-active [data-id] { transition: opacity 200ms } .toast-leave-to [data-id] { opacity: 0 }',
    );
    const { exposed } = mount(ToastAnchored, { group: { duration: 200 } });
    await nextTick();
    const manager = exposed.manager as Manager;
    const onRemove = vi.fn();
    manager.add({
      id: 'a',
      description: 'A',
      timeout: 0,
      onRemove,
      positionerProps: { anchor: byId('anchor') },
    });
    await waitFor(() => expect(toastRoot('a')).not.toBe(null));
    const root = toastRoot('a')!;
    manager.close('a');
    await wait(100);
    expect(root.isConnected).toBe(true);
    await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(1));
    expect(root.isConnected).toBe(false);
  });
});

describe('VUE-60: one root node', () => {
  test('the viewport renders one element, with its sentinels in it after F6', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    byId('toast-before').focus();
    await pressF6();
    const region = viewport();
    expect(region.previousElementSibling?.getAttribute('tabindex')).not.toBe('0');
    expect(region.firstElementChild).toHaveAttribute('tabindex', '0');
    expect(region.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(region.lastElementChild).toHaveAttribute('tabindex', '0');
  });
});

// The case throws in `setup`, so it is the last of the file.
describe('a part outside its parent', () => {
  test('throws an error that names the part and its parent', () => {
    expect(String(mountError(ToastPartAlone, { part: 'Root' }))).toContain(
      '<Toast.Root> must be inside <Toast.Provider>',
    );
    expect(String(mountError(ToastPartAlone, { part: 'Title', inProvider: true }))).toContain(
      '<Toast.Title> must be inside <Toast.Root>',
    );
    expect(String(mountError(ToastPartAlone, { part: 'useToastManager' }))).toContain(
      'Toast.useToastManager() must be inside <Toast.Provider>',
    );
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  });
});
