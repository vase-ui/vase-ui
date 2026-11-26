import axe from 'axe-core';
import { afterEach, describe, expect, inject, onTestFinished, test, vi } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { h, nextTick, reactive, watchEffect } from 'vue';
import type { UseToastManagerReturnValue } from '@vase-ui/vue/toast';
import PopoverParts from '../../test/fixtures/PopoverParts.vue';
import ToastAnchored from '../../test/fixtures/ToastAnchored.vue';
import ToastConformance from '../../test/fixtures/ToastConformance.vue';
import ToastElementSlots from '../../test/fixtures/ToastElementSlots.vue';
import ToastLabelInTransition from '../../test/fixtures/ToastLabelInTransition.vue';
import ToastLabelSlots, { type LabelSlot } from '../../test/fixtures/ToastLabelSlots.vue';
import ToastPartAlone from '../../test/fixtures/ToastPartAlone.vue';
import ToastParts from '../../test/fixtures/ToastParts.vue';
import ToastTwoProviders from '../../test/fixtures/ToastTwoProviders.vue';
import { finishAnimations } from '../../test/animation';
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
// A label that is a function gives virtual DOM content. A Vapor app renders it only with the
// interop plugin.
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

/**
 * A keydown of F6 to dispatch. In Firefox, a real F6 that no listener prevents moves the focus out
 * of the page.
 */
function f6Event() {
  return new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true });
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
      list: { root: { as: 'section' }, action: { as: 'span' }, title: { as: 'h3' } },
    });
    await added(manager, { id: 'a', title: 'Title', actionProps: { children: 'Undo' } });
    const root = toastRoot('a')!;
    expect(root.localName).toBe('section');
    expect(root.querySelector('h3')).toHaveTextContent('Title');
    const action = root.querySelector('span[role="button"]')!;
    expect(action).toHaveTextContent('Undo');
    expect(action).toHaveAttribute('tabindex', '0');
    expect(action).not.toHaveAttribute('type');
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

describe('the API of each part', () => {
  const TAGS: Record<string, string> = {
    Viewport: 'div',
    Root: 'div',
    Content: 'div',
    Title: 'h2',
    Description: 'p',
    Action: 'button',
    Close: 'button',
    Positioner: 'div',
    Arrow: 'div',
  };
  const PARTS = Object.keys(TAGS);
  const part = (name: string) => document.querySelector<HTMLElement>(`[data-part="${name}"]`)!;

  test('each part renders its element and gives it to a template ref; the attributes, the class and the style of the developer reach it', async () => {
    const attributes = Object.fromEntries(
      PARTS.map((name) => [
        name,
        { 'data-testid': `${name}-test`, class: 'mine', style: { color: 'red' } },
      ]),
    );
    const { exposed } = mount(ToastConformance, { attributes });
    await nextTick();
    for (const name of PARTS) {
      const element = part(name);
      expect(element.localName, name).toBe(TAGS[name]);
      expect(element, name).toHaveAttribute('data-testid', `${name}-test`);
      expect(element, name).toHaveClass('mine');
      expect(element.style.color, name).toBe('red');
      expect(exposed.parts[name].element, name).toBe(element);
    }
  });

  test('with `as`, each part renders that tag with its content, and a template ref gives it', async () => {
    const as = Object.fromEntries(PARTS.map((name) => [name, 'section']));
    const { exposed } = mount(ToastConformance, { as });
    await nextTick();
    for (const name of PARTS) {
      expect(part(name).localName, name).toBe('section');
      expect(exposed.parts[name].element, name).toBe(part(name));
    }
    expect(part('Title')).toHaveTextContent('Title');
    expect(part('Description')).toHaveTextContent('Description');
    expect(part('Action')).toHaveTextContent('Undo');
    expect(part('Close')).toHaveAttribute('role', 'button');
    expect(part('Root')).toHaveAttribute('aria-labelledby', part('Title').id);
  });

  test('the `element` slot of each part renders the element of the developer with the props of the part, and a template ref gives it', async () => {
    const { exposed } = mount(ToastConformance, { slots: true });
    await nextTick();
    for (const name of PARTS) {
      expect(part(name).localName, name).toBe('section');
      expect(exposed.parts[name].element, name).toBe(part(name));
    }
    expect(part('Viewport')).toHaveAttribute('role', 'region');
    expect(part('Root')).toHaveAttribute('role', 'dialog');
    expect(part('Root')).toHaveAttribute('aria-labelledby', part('Title').id);
    expect(part('Root')).toHaveAttribute('aria-describedby', part('Description').id);
    // A collapsed stack takes Close out of the tab order.
    for (const [name, tabindex] of [
      ['Action', '0'],
      ['Close', '-1'],
    ] as const) {
      expect(part(name), name).toHaveAttribute('role', 'button');
      expect(part(name), name).toHaveAttribute('tabindex', tabindex);
    }
    expect(part('Arrow')).toHaveAttribute('aria-hidden', 'true');
    expect(part('Positioner')).toHaveAttribute('data-side', 'top');
  });
});

describe('the list', () => {
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
    const before = manager.toasts.value;
    manager.update('missing', updater);
    expect(updater).not.toHaveBeenCalled();
    expect(manager.toasts.value).toBe(before);
    manager.close('a');
    manager.update('a', updater);
    expect(updater).not.toHaveBeenCalled();
    expect(manager.toasts.value).toEqual([]);
  });

  test('`data: undefined` clears the data, and an update with no `data` keeps it; a function gets a toast with no data as `undefined`; a function in `data` is the value', async () => {
    const { manager } = await mountToasts();
    const value = () => 'value';
    manager.add({ id: 'a' });
    const updater = vi.fn((toast: { data?: unknown }) => ({ data: toast.data ?? { note: 'new' } }));
    manager.update('a', updater);
    expect(updater.mock.calls[0]![0].data).toBe(undefined);
    expect(manager.toasts.value[0]!.data).toEqual({ note: 'new' });
    manager.update('a', { title: 'Saved' });
    expect(manager.toasts.value[0]!.data).toEqual({ note: 'new' });
    manager.update('a', { data: undefined });
    expect(manager.toasts.value[0]!.data).toBe(undefined);
    manager.update('a', { data: value as never });
    expect(manager.toasts.value[0]!.data).toBe(value);
  });

  test('a toast that a function of `update` adds stays; a toast that the function closes stays closed', async () => {
    const { manager } = await mountToasts();
    manager.add({ id: 'a', data: { note: 'one' } });
    manager.update('a', () => {
      manager.add({ id: 'b' });
      return { data: { note: 'two' } };
    });
    expect(manager.toasts.value.map((toast) => toast.id)).toEqual(['b', 'a']);
    expect(manager.toasts.value[1]!.data).toEqual({ note: 'two' });
    manager.update('a', () => {
      manager.close('a');
      return { data: { note: 'three' } };
    });
    expect(manager.toasts.value.map((toast) => toast.id)).toEqual(['b']);
  });

  test('an add with the id of an open toast replaces its `data`, and an add with no `data` keeps it; a function is the value', async () => {
    const { manager } = await mountToasts();
    const value = () => 'first';
    const next = () => 'second';
    manager.add({ id: 'a', data: value as never });
    manager.add({ id: 'a', data: next as never });
    expect(manager.toasts.value[0]!.data).toBe(next);
    manager.add({ id: 'a', data: { note: 'ok' } });
    expect(manager.toasts.value[0]!.data).toEqual({ note: 'ok' });
    manager.add({ id: 'a', title: 'Still' });
    expect(manager.toasts.value[0]!.data).toEqual({ note: 'ok' });
  });

  test('an `onClose` that closes each toast closes each other toast one time', async () => {
    const { manager } = await mountToasts();
    const second = vi.fn();
    const first = vi.fn(() => manager.close());
    manager.add({ id: 'a', onClose: first });
    manager.add({ id: 'b', onClose: second });
    manager.close('a');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(manager.toasts.value).toEqual([]);
  });

  test('a close of a toast takes the next toast out of the limit; an add with the id of a limited toast keeps it in place and limited', async () => {
    const { manager } = await mountToasts({ provider: { limit: 1 } });
    await added(manager, { id: 'save', title: 'Saving' }, { id: 'other', title: 'Other' });
    expect(toastRoot('save')).toHaveAttribute('inert');
    manager.add({ id: 'save', title: 'Saved', timeout: 0 });
    await nextTick();
    expect(manager.toasts.value.map((toast) => [toast.id, toast.limited])).toEqual([
      ['other', false],
      ['save', true],
    ]);
    expect(toastRoot('save')).toHaveAttribute('inert');
    expect(toastRoot('save')).toHaveTextContent('Saved');
    manager.close('other');
    await nextTick();
    expect(toastRoot('save')).not.toHaveAttribute('inert');
  });

  test('a root that gets a copy of its toast object has its index and its offset, and its close button closes it', async () => {
    const { manager } = await mountToasts({ list: { copies: true } });
    await added(manager, { id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' });
    expect(
      ['c', 'b', 'a'].map((id) => toastRoot(id)!.style.getPropertyValue('--toast-index')),
    ).toEqual(['0', '1', '2']);
    await waitFor(() =>
      expect(toastRoot('b')!.style.getPropertyValue('--toast-offset-y')).not.toBe('0px'),
    );
    await userEvent.click(toastRoot('c')!.querySelector('button')!, { force: true });
    await waitFor(() => expect(toastRoot('c')).toBe(null));
    expect(manager.toasts.value.map((toast) => toast.id)).toEqual(['b', 'a']);
  });

  test('the type of a toast is `data-type` on each part', async () => {
    const { manager } = await mountToasts();
    await added(manager, {
      id: 'a',
      type: 'success',
      title: 'Title',
      description: 'Description',
      actionProps: { children: 'Undo' },
    });
    const root = toastRoot('a')!;
    for (const element of [root, root.querySelector('h2'), root.querySelector('p')]) {
      expect(element).toHaveAttribute('data-type', 'success');
    }
    for (const button of root.querySelectorAll('button')) {
      expect(button).toHaveAttribute('data-type', 'success');
    }
  });

  test('promise with the `id` of an open toast updates that toast; an update by the id holds until the result', async () => {
    const { manager } = await mountToasts();
    manager.add({ id: 'save', title: 'Before' });
    let resolve!: (value: string) => void;
    const result = manager.promise(new Promise<string>((done) => (resolve = done)), {
      loading: { id: 'save', title: 'Saving' },
      success: { title: 'Saved' },
      error: 'Failed',
    });
    expect(manager.toasts.value).toHaveLength(1);
    expect(manager.toasts.value[0]).toMatchObject({ id: 'save', title: 'Saving', type: 'loading' });
    manager.update('save', { title: 'Still saving' });
    expect(manager.toasts.value[0]!.title).toBe('Still saving');
    resolve('done');
    await result;
    expect(manager.toasts.value[0]).toMatchObject({ title: 'Saved', type: 'success' });
  });

  test('promise keeps a function in `data` as the value; the error state takes a text or a function of the reason; the loading state takes options', async () => {
    const { manager } = await mountToasts();
    const loading = () => 'loading';
    const success = () => 'done';
    await manager.promise(Promise.resolve('done'), {
      loading: { id: 'a', title: 'Saving', description: 'Wait', data: loading as never },
      success: { title: 'Saved', data: success as never },
      error: 'Failed',
    });
    expect(manager.toasts.value[0]!.data).toBe(success);
    await manager
      .promise(Promise.reject(new Error('Disk full')), {
        loading: { id: 'b', title: 'Saving', description: 'Wait' },
        success: 'Saved',
        error: (error: Error) => error.message,
      })
      .catch(() => {});
    expect(manager.toasts.value[0]).toMatchObject({
      id: 'b',
      type: 'error',
      title: 'Saving',
      description: 'Disk full',
    });
    await manager
      .promise(Promise.reject(new Error('reason')), {
        loading: 'Saving',
        success: 'Saved',
        error: 'Failed',
      })
      .catch(() => {});
    expect(manager.toasts.value[0]).toMatchObject({ type: 'error', description: 'Failed' });
  });

  test('a promise toast that the user closed does not open again when the promise settles', async () => {
    const { manager } = await mountToasts();
    let resolve!: (value: string) => void;
    const result = manager.promise(new Promise<string>((done) => (resolve = done)), {
      loading: { id: 'a', title: 'Saving' },
      success: 'Saved',
      error: 'Failed',
    });
    await waitFor(() => expect(toastRoot('a')).not.toBe(null));
    await userEvent.click(toastRoot('a')!.querySelector('button')!, { force: true });
    expect(manager.toasts.value).toEqual([]);
    resolve('done');
    await result;
    expect(manager.toasts.value).toEqual([]);
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

describe('the timers', () => {
  function fakeTimers() {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  }

  async function advance(ms: number) {
    vi.advanceTimersByTime(ms);
    await nextTick();
  }

  test('a toast with no timeout closes after 5 s with a provider that has no timeout', async () => {
    const { manager } = await mountToasts();
    fakeTimers();
    manager.add({ id: 'a' });
    await advance(4999);
    expect(manager.toasts.value).toHaveLength(1);
    await advance(2);
    expect(manager.toasts.value).toEqual([]);
  });

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

  test('a toast that closes at the end of its time calls its `onClose`', async () => {
    const { manager } = await mountToasts();
    fakeTimers();
    const onClose = vi.fn();
    manager.add({ id: 'a', timeout: 1000, onClose });
    await advance(999);
    expect(onClose).not.toHaveBeenCalled();
    await advance(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test.each([
    { name: 'with its timeout', again: { timeout: 1000 } },
    { name: 'with no timeout', again: {} },
  ])('an add $name with the id of an open toast starts its full time again', async ({ again }) => {
    const { manager } = await mountToasts();
    fakeTimers();
    manager.add({ id: 'save', title: 'Saving', timeout: 1000 });
    await advance(900);
    expect(manager.add({ id: 'save', title: 'Saved', ...again })).toBe('save');
    await advance(200);
    expect(manager.toasts.value).toHaveLength(1);
    expect(manager.toasts.value[0]!.title).toBe('Saved');
    await advance(800);
    expect(manager.toasts.value).toEqual([]);
  });

  test('an update of the timeout from 0 starts the timer, and a second update with the same timeout starts the full time again', async () => {
    const { manager } = await mountToasts();
    fakeTimers();
    manager.add({ id: 'a', timeout: 0 });
    await advance(5000);
    manager.update('a', { timeout: 1000 });
    await advance(900);
    manager.update('a', { timeout: 1000 });
    await advance(200);
    expect(manager.toasts.value).toHaveLength(1);
    await advance(800);
    expect(manager.toasts.value).toEqual([]);
  });

  test('a loading toast that two updates change before a render closes after the timeout of the first update', async () => {
    const { manager } = await mountToasts();
    fakeTimers();
    manager.add({ id: 'a', type: 'loading', title: 'Loading' });
    manager.update('a', { type: 'success', timeout: 1000 });
    manager.update('a', { title: 'New' });
    await advance(999);
    expect(manager.toasts.value[0]!.title).toBe('New');
    await advance(2);
    expect(manager.toasts.value).toEqual([]);
  });

  test.each([
    { name: 'a success with no timeout', provider: {}, settle: 'resolve', state: {}, closes: 5000 },
    { name: 'an error with no timeout', provider: {}, settle: 'reject', state: {}, closes: 5000 },
    {
      name: 'a success with its timeout',
      provider: {},
      settle: 'resolve',
      state: { timeout: 2000 },
      closes: 2000,
    },
    {
      name: 'an error with its timeout',
      provider: {},
      settle: 'reject',
      state: { timeout: 3000 },
      closes: 3000,
    },
    {
      name: 'the timeout of the provider',
      provider: { timeout: 1000 },
      settle: 'resolve',
      state: {},
      closes: 1000,
    },
    {
      name: 'a loading state with the timeout 0',
      provider: {},
      settle: 'resolve',
      state: {},
      loading: { timeout: 0 },
      closes: 5000,
    },
    {
      name: 'a success with the timeout 0',
      provider: {},
      settle: 'resolve',
      state: { timeout: 0 },
      closes: null,
    },
  ])(
    'promise: the toast of $name closes after the time of that state',
    async ({ provider, settle, state, loading, closes }) => {
      const { manager } = await mountToasts({ provider });
      fakeTimers();
      let resolve!: (value: string) => void;
      let reject!: (reason: Error) => void;
      const result = manager.promise(
        new Promise<string>((done, fail) => {
          resolve = done;
          reject = fail;
        }),
        {
          loading: { description: 'Loading', ...loading },
          success: { description: 'Success', ...state },
          error: { description: 'Error', ...state },
        },
      );
      await advance(1000);
      expect(manager.toasts.value[0]!.description).toBe('Loading');
      if (settle === 'resolve') resolve('done');
      else reject(new Error('reason'));
      await result.catch(() => {});
      expect(manager.toasts.value[0]!.description).toBe(settle === 'resolve' ? 'Success' : 'Error');
      await advance((closes ?? 10000) - 1);
      expect(manager.toasts.value).toHaveLength(1);
      await advance(2);
      expect(manager.toasts.value).toHaveLength(closes === null ? 1 : 0);
    },
  );

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

describe('enter and leave', () => {
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

  test('with JavaScript hooks, `onRemove` and the end of the held leave come after `done`', async () => {
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

describe('the stack', () => {
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

  test('measures the natural height again when the content changes, also in a root with a fixed height', async () => {
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

  test('a front toast whose content grows after it opens gives no resize loop error when a toast behind follows `--toast-frontmost-height`', async () => {
    style(
      '[data-id] { position: absolute; top: 0; width: 200px; height: var(--toast-frontmost-height, var(--toast-height)); }' +
        '[data-id="a"] [data-testid="content"] { height: 100%; }',
    );
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'Back' }, { id: 'b', title: 'Front' });
    await waitFor(() => expect(manager.toasts.value[0]!.height).toBeGreaterThan(0));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const errors: string[] = [];
    const onError = (event: ErrorEvent) => errors.push(event.message);
    window.addEventListener('error', onError);
    onTestFinished(() => window.removeEventListener('error', onError));

    const first = manager.toasts.value[0]!.height!;
    const frontContent = toastRoot('b')!.querySelector<HTMLElement>('[data-testid="content"]')!;
    frontContent.style.paddingBottom = '30px';
    await waitFor(() => expect(manager.toasts.value[0]!.height).toBe(first + 30));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(errors).toEqual([]);
    expect(viewport().style.getPropertyValue('--toast-frontmost-height')).toBe(`${first + 30}px`);
  });
});

describe('the roots', () => {
  test('a root that mounts again registers again: it measures its height, and Tab after F6 focuses it', async () => {
    const list = reactive<Props>({ withoutRoots: false });
    const { manager } = await mountToasts({ list });
    await added(manager, { id: 'a', title: 'A' });
    const first = toastRoot('a')!;
    await waitFor(() => expect(first.style.getPropertyValue('--toast-height')).not.toBe(''));
    const height = parseFloat(first.style.getPropertyValue('--toast-height'));
    list.withoutRoots = true;
    await waitFor(() => expect(toastRoot('a')).toBe(null));
    list.withoutRoots = false;
    list.titleText = 'A much longer title\nthat wraps on more lines '.repeat(10);
    await waitFor(() => expect(toastRoot('a')).not.toBe(null));
    const again = toastRoot('a')!;
    expect(again).not.toBe(first);
    await waitFor(() =>
      expect(parseFloat(again.style.getPropertyValue('--toast-height'))).toBeGreaterThan(height),
    );
    byId('toast-before').focus();
    await pressF6();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(again);
  });

  test('an add with the id of a toast in its leave puts the new toast in front, measured and not behind; the other toast stays behind it', async () => {
    style('.toast-leave-active { transition: opacity 300ms } .toast-leave-to { opacity: 0 }');
    const { manager } = await mountToasts();
    await added(manager, { id: 't1', title: 'One' }, { id: 't2', title: 'Two' });
    const leaving = toastRoot('t1')!;
    manager.close('t1');
    await nextTick();
    manager.add({ id: 't1', title: 'One again', timeout: 0 });
    await waitFor(() => expect(leaving.isConnected).toBe(false));
    const again = toastRoot('t1')!;
    await waitFor(() => expect(again.style.getPropertyValue('--toast-height')).not.toBe(''));
    expect(again.style.getPropertyValue('--toast-index')).toBe('0');
    expect(again.querySelector('[data-testid="content"]')).not.toHaveAttribute('data-behind');
    expect(toastRoot('t2')!.style.getPropertyValue('--toast-index')).toBe('1');
    expect(toastRoot('t2')!.querySelector('[data-testid="content"]')).toHaveAttribute(
      'data-behind',
    );
  });

  test('the content has `data-expanded` while the pointer is on the viewport', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    const content = toastRoot('a')!.querySelector('[data-testid="content"]')!;
    expect(content).not.toHaveAttribute('data-expanded');
    await userEvent.hover(toastRoot('a')!);
    await waitFor(() => expect(content).toHaveAttribute('data-expanded'));
  });
});

describe('hover, focus and the window', () => {
  test('the stack stays expanded from a close under the pointer to the end of the leave', async () => {
    // The leave lasts until the case ends it, so the pointer leaves the stack during the leave.
    style('.toast-leave-active { transition: opacity 100s } .toast-leave-to { opacity: 0 }');
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' }, { id: 'b', title: 'B' });
    await userEvent.hover(toastRoot('b')!);
    await waitFor(() => expect(viewport()).toHaveAttribute('data-expanded'));
    const leaving = toastRoot('b')!;
    manager.close('b');
    await userEvent.pointer({ coords: { x: 0, y: 0 } });
    expect(leaving.isConnected).toBe(true);
    expect(viewport()).toHaveAttribute('data-expanded');
    await finishAnimations(leaving);
    await waitFor(() => expect(leaving.isConnected).toBe(false));
    await waitFor(() => expect(viewport()).not.toHaveAttribute('data-expanded'));
  });

  test('a blur of the window while the leave holds the end of the hover does not keep the stack expanded after the leave', async () => {
    style('.toast-leave-active { transition: opacity 300ms } .toast-leave-to { opacity: 0 }');
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' }, { id: 'b', title: 'B' });
    await userEvent.hover(toastRoot('b')!);
    await waitFor(() => expect(viewport()).toHaveAttribute('data-expanded'));
    const leaving = toastRoot('b')!;
    manager.close('b');
    await userEvent.pointer({ coords: { x: 0, y: 0 } });
    window.dispatchEvent(new FocusEvent('blur'));
    expect(viewport()).toHaveAttribute('data-expanded');
    await waitFor(() => expect(leaving.isConnected).toBe(false));
    await waitFor(() => expect(viewport()).not.toHaveAttribute('data-expanded'));
    window.dispatchEvent(new FocusEvent('focus'));
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

describe('the keys', () => {
  test('F6 moves the focus to the viewport; F6 in it returns the focus to its origin', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    byId('toast-before').focus();
    await pressF6();
    expect(document.activeElement).toBe(viewport());
    expect(viewport().matches(':focus-visible')).toBe(true);
    await pressF6();
    expect(document.activeElement).toBe(byId('toast-before'));
    await pressF6();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(toastRoot('a'));
    await pressF6();
    expect(document.activeElement).toBe(byId('toast-before'));
  });

  test('F6 does nothing with no toast, or when a listener prevented it', async () => {
    const f6 = () => byId('toast-before').dispatchEvent(f6Event());
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
    expect(toastRoot('a')!.dispatchEvent(f6Event())).toBe(true);
    expect(document.activeElement).toBe(toastRoot('a'));
  });

  test('F6 in a toast that got the focus with no F6, after an earlier visit with F6, stays with the browser', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    byId('toast-before').focus();
    await pressF6();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(byId('toast-before'));
    toastRoot('a')!.focus();
    expect(toastRoot('a')!.dispatchEvent(f6Event())).toBe(true);
    expect(document.activeElement).toBe(toastRoot('a'));
  });

  test.each([
    { name: 'removed', change: (element: HTMLInputElement) => element.remove() },
    { name: 'hidden', change: (element: HTMLInputElement) => (element.hidden = true) },
    { name: 'disabled', change: (element: HTMLInputElement) => (element.disabled = true) },
    { name: 'inert', change: (element: HTMLInputElement) => (element.inert = true) },
  ])('F6 in the viewport stays with the browser when its origin is $name', async ({ change }) => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    const origin = document.body.appendChild(document.createElement('input'));
    origin.setAttribute('aria-label', 'Origin');
    onTestFinished(() => origin.remove());
    origin.focus();
    await pressF6();
    expect(document.activeElement).toBe(viewport());
    change(origin);
    expect(viewport().dispatchEvent(f6Event())).toBe(true);
    expect(document.activeElement).toBe(viewport());
  });

  test.each([
    {
      name: 'prevents',
      listener: (event: KeyboardEvent) => event.preventDefault(),
      press: pressF6,
    },
    {
      name: 'stops',
      listener: (event: KeyboardEvent) => event.stopPropagation(),
      press: () => viewport().dispatchEvent(f6Event()),
    },
  ])(
    'a capture listener on the viewport that $name F6 keeps the focus in the viewport',
    async ({ listener, press }) => {
      const { manager } = await mountToasts({
        list: { viewport: { onKeydownCapture: listener } },
      });
      await added(manager, { id: 'a', title: 'A' });
      byId('toast-before').focus();
      await pressF6();
      expect(document.activeElement).toBe(viewport());
      await press();
      expect(document.activeElement).toBe(viewport());
    },
  );

  test('a focus listener of the viewport that moves the focus to a toast keeps the origin: Shift+Tab on the toast returns the focus to it', async () => {
    const { manager } = await mountToasts({
      list: {
        viewport: {
          onFocus: (event: FocusEvent) => {
            if (event.target === event.currentTarget) toastRoot('a')?.focus();
          },
        },
      },
    });
    await added(manager, { id: 'a', title: 'A' });
    byId('toast-before').focus();
    await pressF6();
    expect(document.activeElement).toBe(toastRoot('a'));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(byId('toast-before'));
  });

  test('a focus listener of the viewport that closes each toast returns the focus to the origin of F6', async () => {
    const { manager } = await mountToasts({
      list: { viewport: { onFocus: () => manager.close() } },
    });
    await added(manager, { id: 'a', title: 'A' });
    byId('toast-before').focus();
    await pressF6();
    expect(manager.toasts.value).toEqual([]);
    expect(document.activeElement).toBe(byId('toast-before'));
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
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(toastRoot('a'));
    await pressF6();
    expect(document.activeElement).toBe(document.body);
  });

  test('VUE-232: while a toast of high priority has no tab stop, the viewport has one: Tab moves the focus to the first toast, Shift+Tab from after the viewport to the last, and F6 keeps it on the viewport', async () => {
    const { manager } = await mountToasts({ inPlace: true });
    await added(
      manager,
      { id: 'a', title: 'A', priority: 'high' },
      { id: 'b', title: 'B', priority: 'high' },
    );
    expect(viewport()).toHaveAttribute('tabindex', '0');
    byId('toast-before').focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(toastRoot('b'));
    expect(toastRoot('b')!.matches(':focus-visible')).toBe(true);
    await waitFor(() => expect(viewport()).toHaveAttribute('tabindex', '-1'));
    byId('toast-after').focus();
    await waitFor(() => expect(viewport()).toHaveAttribute('tabindex', '0'));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(toastRoot('a'));
    byId('toast-before').focus();
    await waitFor(() => expect(viewport()).toHaveAttribute('tabindex', '0'));
    await pressF6();
    expect(document.activeElement).toBe(viewport());
  });

  test('a press on the viewport gives the focus to it and to no toast of high priority; Shift+Tab from a pressed toast stops on the viewport', async () => {
    // A press on a child of the root would start Shift+Tab from the child in WebKit.
    style('[data-testid="viewport"], [data-id] { padding: 40px }');
    const { manager } = await mountToasts({ inPlace: true });
    await added(manager, { id: 'a', title: 'A', priority: 'high' }, { id: 'b', title: 'B' });
    await userEvent.click(viewport(), { position: { x: 5, y: 5 } });
    expect(document.activeElement).toBe(viewport());
    expect(toastRoot('a')).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(toastRoot('b')!, { position: { x: 5, y: 5 } });
    expect(document.activeElement).toBe(toastRoot('b'));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(viewport());
  });

  test('VUE-232: Tab after a press on a toast of high priority reaches its Action and its Close', async () => {
    style('[data-id] { padding: 40px }');
    const { manager } = await mountToasts({ inPlace: true });
    await added(manager, {
      id: 'a',
      title: 'A',
      priority: 'high',
      actionProps: { children: 'Undo' },
    });
    const root = toastRoot('a')!;
    const [action, close] = root.querySelectorAll('button');
    expect(root).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(root, { position: { x: 5, y: 5 } });
    expect(document.activeElement).toBe(root);
    expect(root).not.toHaveAttribute('aria-hidden');
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(action);
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(close);
  });

  test('VUE-232: after F6, a focus of the viewport that comes from no element, as at the return of the window focus, stays on the viewport', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A', priority: 'high' });
    byId('toast-before').focus();
    await pressF6();
    expect(document.activeElement).toBe(viewport());
    viewport().blur();
    await waitFor(() => expect(viewport()).toHaveAttribute('tabindex', '0'));
    viewport().focus();
    expect(document.activeElement).toBe(viewport());
    expect(viewport().matches(':focus-visible')).toBe(true);
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

  test('an Escape in content that a <Teleport> of the toast moves out of it closes nothing', async () => {
    const { manager } = await mountToasts({ list: { teleportedInput: true } });
    await added(manager, { id: 'a' });
    byId('moved').focus();
    await userEvent.keyboard('{Escape}');
    expect(manager.toasts.value).toHaveLength(1);
  });

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

describe('two providers', () => {
  async function mountTwo() {
    const { exposed } = mount(ToastTwoProviders);
    await nextTick();
    const first = exposed.first as Manager;
    const second = exposed.second as Manager;
    const viewports = () =>
      ['first-viewport', 'second-viewport'].map((id) =>
        document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!,
      );
    return { first, second, viewports };
  }

  test('an update in one provider changes no toast of the other', async () => {
    const { first, second } = await mountTwo();
    const one = first.add({ title: 'First toast', timeout: 0 });
    second.add({ title: 'Second toast', timeout: 0 });
    await nextTick();
    first.update(one, { title: 'First toast updated' });
    await nextTick();
    expect(document.body).toHaveTextContent('First toast updated');
    expect(document.body).toHaveTextContent('Second toast');
    expect(document.body).not.toHaveTextContent('Second toast updated');
  });

  test.each(['F6', 'Shift+Tab'])(
    'F6 moves the focus to one viewport, and %s returns it to the page',
    async (exit) => {
      const { first, second, viewports } = await mountTwo();
      await added(first, { id: 'a', title: 'First' });
      await added(second, { id: 'b', title: 'Second' });
      byId('toast-before').focus();
      await pressF6();
      expect(viewports()).toContain(document.activeElement);
      if (exit === 'F6') await pressF6();
      else await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
      expect(document.activeElement).toBe(byId('toast-before'));
    },
  );

  test.each([
    { name: 'after F6, returns the focus to its origin', withF6: true },
    { name: 'with no F6, stays with the browser', withF6: false },
  ])('F6 in the focused first viewport $name, before the other provider', async ({ withF6 }) => {
    const { first, second, viewports } = await mountTwo();
    await added(first, { id: 'a', title: 'First' });
    await added(second, { id: 'b', title: 'Second' });
    byId('toast-before').focus();
    const [firstViewport] = viewports();
    if (withF6) await pressF6();
    else firstViewport!.focus();
    expect(document.activeElement).toBe(firstViewport);
    expect(firstViewport!.dispatchEvent(f6Event())).toBe(!withF6);
    expect(document.activeElement).toBe(withF6 ? byId('toast-before') : firstViewport);
  });

  test('a focus listener of the viewport that closes its last toast returns the focus to the origin, and the other provider leaves it there', async () => {
    const { exposed } = mount(ToastTwoProviders, {
      first: { viewport: { onFocus: () => (exposed.first as Manager).close() } },
    });
    await nextTick();
    await added(exposed.first as Manager, { id: 'a', title: 'First' });
    await added(exposed.second as Manager, { id: 'b', title: 'Second' });
    byId('toast-before').focus();
    await pressF6();
    expect(document.activeElement).toBe(byId('toast-before'));
  });
});

describe('the focus and the timers', () => {
  test('a focus listener of the viewport that moves the focus out keeps the stack collapsed, and the timers run', async () => {
    const { manager } = await mountToasts({
      list: { viewport: { onFocus: () => byId('toast-before').focus() } },
    });
    await added(manager, { id: 'a', title: 'A' });
    byId('toast-before').focus();
    await pressF6();
    expect(document.activeElement).toBe(byId('toast-before'));
    expect(viewport()).not.toHaveAttribute('data-expanded');
    manager.update('a', { timeout: 100 });
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
  });

  test('after a focus listener of the viewport closes the last toast, the stack is collapsed; a new toast waits only while the pointer is on the viewport', async () => {
    let closeAll = true;
    const { manager } = await mountToasts({
      list: {
        viewport: {
          onFocus: () => {
            if (closeAll) manager.close();
          },
        },
      },
    });
    await added(manager, { id: 'a', title: 'A' });
    byId('toast-before').focus();
    await pressF6();
    closeAll = false;
    expect(manager.toasts.value).toEqual([]);
    expect(document.activeElement).toBe(byId('toast-before'));
    await added(manager, { id: 'b', title: 'B' });
    expect(viewport()).not.toHaveAttribute('data-expanded');
    await userEvent.hover(toastRoot('b')!);
    await waitFor(() => expect(viewport()).toHaveAttribute('data-expanded'));
    manager.update('b', { timeout: 100 });
    await wait(300);
    expect(manager.toasts.value).toHaveLength(1);
    await userEvent.pointer({ coords: { x: 0, y: 0 } });
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
  });

  test.each(['the hover', 'the keyboard focus'])(
    'the timers stay stopped while %s stays after the other ends',
    async (stays) => {
      const { manager } = await mountToasts();
      await added(manager, { id: 'a', title: 'A', actionProps: { children: 'Undo' } });
      byId('toast-before').focus();
      await pressF6();
      await userEvent.keyboard('{Tab}{Tab}');
      expect(document.activeElement).toHaveTextContent('Undo');
      await userEvent.hover(toastRoot('a')!);
      if (stays === 'the hover') byId('toast-before').focus();
      else await userEvent.pointer({ coords: { x: 0, y: 0 } });
      manager.update('a', { timeout: 100 });
      await wait(300);
      expect(manager.toasts.value).toHaveLength(1);
      if (stays === 'the hover') await userEvent.pointer({ coords: { x: 0, y: 0 } });
      else byId('toast-before').focus();
      await waitFor(() => expect(manager.toasts.value).toEqual([]));
    },
  );

  test('Shift+Tab on the viewport after F6 returns the focus and starts the timers; Tab moves into the toasts and keeps them stopped', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    byId('toast-before').focus();
    await pressF6();
    manager.update('a', { timeout: 100 });
    await wait(300);
    expect(manager.toasts.value).toHaveLength(1);
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(toastRoot('a'));
    await wait(300);
    expect(manager.toasts.value).toHaveLength(1);
    await pressF6();
    await pressF6();
    expect(document.activeElement).toBe(viewport());
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(byId('toast-before'));
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
  });

  test('the stack stays expanded when the pointer leaves while a keyboard focus is in the viewport', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    byId('toast-before').focus();
    await pressF6();
    await userEvent.keyboard('{Tab}');
    await userEvent.hover(toastRoot('a')!);
    const content = toastRoot('a')!.querySelector('[data-testid="content"]')!;
    await waitFor(() => expect(content).toHaveAttribute('data-expanded'));
    await userEvent.pointer({ coords: { x: 0, y: 0 } });
    await wait(50);
    expect(viewport()).toHaveAttribute('data-expanded');
    expect(content).toHaveAttribute('data-expanded');
  });

  test('after a focus that left the viewport with no key, F6 again stops the timers', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    byId('toast-before').focus();
    await pressF6();
    byId('toast-before').focus();
    await pressF6();
    expect(document.activeElement).toBe(viewport());
    expect(viewport()).toHaveAttribute('data-expanded');
    manager.update('a', { timeout: 100 });
    await wait(300);
    expect(manager.toasts.value).toHaveLength(1);
  });

  test('a Tab past the last toast with an origin that cannot take the focus keeps the focus in the viewport; a focus outside it then starts the timers', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    const origin = byId('toast-before') as HTMLInputElement;
    origin.focus();
    await pressF6();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(toastRoot('a'));
    origin.disabled = true;
    // The root, its close button, and the sentinel after the toasts.
    await userEvent.keyboard('{Tab}{Tab}');
    expect(viewport().contains(document.activeElement)).toBe(true);
    byId('toast-after').focus();
    await waitFor(() => expect(viewport()).not.toHaveAttribute('data-expanded'));
    manager.update('a', { timeout: 100 });
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
  });

  test('a touch in the viewport keeps the stack expanded; a press of the mouse outside it does not end the hover', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    await userEvent.hover(toastRoot('a')!);
    await waitFor(() => expect(viewport()).toHaveAttribute('data-expanded'));
    viewport().dispatchEvent(
      new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
    );
    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true }),
    );
    expect(viewport()).toHaveAttribute('data-expanded');
    manager.update('a', { timeout: 100 });
    await wait(300);
    expect(manager.toasts.value).toHaveLength(1);
  });

  test('a mouse click on a toast with no keyboard focus before it keeps the timers stopped while the pointer stays', async () => {
    const { manager } = await mountToasts({ provider: { timeout: 300 } });
    await added(manager, { id: 'a', title: 'A' });
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.click(toastRoot('a')!.querySelector('h2')!);
    expect(document.activeElement).toBe(toastRoot('a'));
    manager.update('a', { timeout: 300 });
    await wait(600);
    expect(manager.toasts.value).toHaveLength(1);
  });
});

describe('the window', () => {
  const blur = () => window.dispatchEvent(new FocusEvent('blur'));
  const focus = () => window.dispatchEvent(new FocusEvent('focus'));

  test('a toast that comes while the window has no focus waits until the window has the focus', async () => {
    const { manager } = await mountToasts();
    blur();
    manager.add({ id: 'a', timeout: 100 });
    await wait(300);
    expect(manager.toasts.value).toHaveLength(1);
    focus();
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
  });

  test('a blur of the window again before its focus settles keeps the timers stopped', async () => {
    const { manager } = await mountToasts();
    manager.add({ id: 'a', timeout: 100 });
    blur();
    focus();
    blur();
    await wait(300);
    expect(manager.toasts.value).toHaveLength(1);
    focus();
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
  });

  test('a toast that comes after the window got the focus back while the list was empty runs its timer', async () => {
    const { manager } = await mountToasts();
    manager.add({ id: 'manual', timeout: 0 });
    blur();
    manager.close('manual');
    focus();
    manager.add({ id: 'a', timeout: 100 });
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
  });

  test('a toast that a focus listener of the window adds, after a blur with an empty list, runs its timer', async () => {
    const { manager } = await mountToasts();
    blur();
    const add = () => manager.add({ id: 'a', timeout: 100 });
    window.addEventListener('focus', add);
    onTestFinished(() => window.removeEventListener('focus', add));
    focus();
    expect(manager.toasts.value).toHaveLength(1);
    await waitFor(() => expect(manager.toasts.value).toEqual([]));
  });

  test('the timers stay stopped when the window gets the focus back while the pointer is on a toast', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    await userEvent.hover(toastRoot('a')!);
    await waitFor(() => expect(viewport()).toHaveAttribute('data-expanded'));
    blur();
    focus();
    manager.update('a', { timeout: 100 });
    await wait(300);
    expect(manager.toasts.value).toHaveLength(1);
  });

  test('a viewport in a frame takes F6 of the frame, also after its list was empty', async () => {
    const frame = document.body.appendChild(document.createElement('iframe'));
    frame.title = 'Frame';
    onTestFinished(() => frame.remove());
    const target = frame.contentDocument!.body;
    const { manager } = await mountToasts({ portal: { to: target } });
    const frameF6 = () =>
      frame.contentWindow!.dispatchEvent(
        new (frame.contentWindow as unknown as typeof window).KeyboardEvent('keydown', {
          key: 'F6',
          cancelable: true,
        }),
      );
    const frameViewport = () => target.querySelector('[data-testid="viewport"]');
    for (const id of ['a', 'b']) {
      manager.add({ id, title: id, timeout: 0 });
      await waitFor(() => expect(target.querySelector(`[data-id="${id}"]`)).not.toBe(null));
      frameF6();
      expect(frame.contentDocument!.activeElement).toBe(frameViewport());
      manager.close();
      await waitFor(() => expect(target.querySelector('[data-id]')).toBe(null));
    }
  });
});

describe('the focus at a close', () => {
  test('Tab from the viewport skips a toast in its leave', async () => {
    style('.toast-leave-active { transition: opacity 2s } .toast-leave-to { opacity: 0 }');
    const { manager } = await mountToasts();
    await added(manager, { id: 'old', title: 'Old' }, { id: 'new', title: 'New' });
    const leaving = toastRoot('new')!;
    manager.close('new');
    await nextTick();
    expect(leaving.isConnected).toBe(true);
    byId('toast-before').focus();
    await pressF6();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(toastRoot('old'));
  });

  test('Tab from the viewport with no toast that can take the focus returns the focus to the origin', async () => {
    const { manager } = await mountToasts({ provider: { limit: 0 } });
    await added(manager, { id: 'a', title: 'A' });
    byId('toast-before').focus();
    await pressF6();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byId('toast-before'));
  });

  test('a close of the focused toast and of a toast in its leave moves the focus past the toast in its leave', async () => {
    style('.toast-leave-active { transition: opacity 2s } .toast-leave-to { opacity: 0 }');
    const { manager } = await mountToasts();
    await added(
      manager,
      { id: 'oldest', title: 'Oldest' },
      { id: 'middle', title: 'Middle' },
      { id: 'newest', title: 'Newest' },
    );
    byId('toast-before').focus();
    await pressF6();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(toastRoot('newest'));
    manager.close('middle');
    manager.close('newest');
    expect(document.activeElement).toBe(toastRoot('oldest'));
  });

  test('a close with the focus outside the viewport leaves the focus', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' }, { id: 'b', title: 'B' });
    byId('toast-before').focus();
    manager.close();
    expect(document.activeElement).toBe(byId('toast-before'));
  });

  test.each([
    {
      name: 'adds a toast that has no root yet',
      setup: (manager: Manager) => [
        { id: 'only', title: 'Only', onClose: () => manager.add({ id: 'later', title: 'Later' }) },
      ],
      focused: 'only',
      next: () => byId('toast-before'),
    },
    {
      name: 'closes another toast',
      setup: (manager: Manager) => [
        { id: 'oldest', title: 'Oldest' },
        { id: 'middle', title: 'Middle', onClose: () => manager.close('oldest') },
        { id: 'newest', title: 'Newest' },
      ],
      focused: 'middle',
      next: () => toastRoot('newest'),
    },
    {
      name: 'adds another toast',
      setup: (manager: Manager) => [
        { id: 'oldest', title: 'Oldest' },
        {
          id: 'middle',
          title: 'Middle',
          onClose: () => manager.add({ id: 'added', title: 'Added' }),
        },
        { id: 'newest', title: 'Newest' },
      ],
      focused: 'middle',
      next: () => toastRoot('oldest'),
    },
  ])(
    'a close of the focused toast whose `onClose` $name moves the focus to a toast that stays, else to the origin',
    async ({ setup, focused, next }) => {
      const { manager } = await mountToasts();
      await added(manager, ...setup(manager));
      byId('toast-before').focus();
      await pressF6();
      toastRoot(focused)!.focus();
      await userEvent.keyboard('{Shift}');
      expect(toastRoot(focused)!.matches(':focus-visible')).toBe(true);
      await userEvent.keyboard('{Escape}');
      expect(document.activeElement).toBe(next());
    },
  );

  test('a close of the focused toast moves the focus to a newer toast when the next older one was over the limit', async () => {
    const { manager } = await mountToasts({ provider: { limit: 2 } });
    await added(
      manager,
      { id: 'oldest', title: 'Oldest' },
      { id: 'middle', title: 'Middle' },
      { id: 'newest', title: 'Newest' },
    );
    expect(toastRoot('oldest')).toHaveAttribute('inert');
    byId('toast-before').focus();
    await pressF6();
    await userEvent.keyboard('{Tab}{Tab}{Tab}');
    expect(document.activeElement).toBe(toastRoot('middle'));
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(toastRoot('newest'));
  });
});

describe('the names and the announcements', () => {
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

  test('the root loses its name and its description when the title and the description unmount, and gets them again when they mount', async () => {
    const list = reactive<Props>({ withoutLabels: false });
    const { manager } = await mountToasts({ list });
    await added(manager, { id: 'a', title: 'Title', description: 'Description' });
    const root = toastRoot('a')!;
    expect(root).toHaveAttribute('aria-labelledby', root.querySelector('h2')!.id);
    expect(root).toHaveAttribute('aria-describedby', root.querySelector('p')!.id);
    list.withoutLabels = true;
    await nextTick();
    expect(root).not.toHaveAttribute('aria-labelledby');
    expect(root).not.toHaveAttribute('aria-describedby');
    list.withoutLabels = false;
    await nextTick();
    expect(root.querySelector('h2')).toHaveTextContent('Title');
    expect(root.querySelector('p')).toHaveTextContent('Description');
    expect(root).toHaveAttribute('aria-labelledby', root.querySelector('h2')!.id);
    expect(root).toHaveAttribute('aria-describedby', root.querySelector('p')!.id);
  });

  describe('VUE-205: a label in the `element` slot', () => {
    type Slots = { title: LabelSlot; description: LabelSlot };

    async function mountLabels(shown: Slots, toast: Props, heading = { text: '' }) {
      const slots = reactive({ ...shown });
      const { exposed } = mount(ToastLabelSlots, { slots, heading });
      await nextTick();
      const manager = exposed.manager as Manager;
      await added(manager, { id: 'a', ...toast });
      await nextTick();
      const root = toastRoot('a')!;
      return {
        root,
        manager,
        slots,
        title: root.querySelector('h3'),
        description: root.querySelector('p'),
      };
    }

    test.each([
      {
        name: 'an empty title element names nothing, and the description names the toast',
        slots: { title: 'label', description: 'label' },
        toast: { description: 'Saved' },
        labelledby: 'description',
        describedby: undefined,
      },
      {
        name: 'a title element with a text of the developer names a toast with no title',
        slots: { title: 'text', description: 'label' },
        toast: { description: 'Saved' },
        labelledby: 'title',
        describedby: 'description',
      },
      {
        name: 'a title slot with no element names no id, and the description names the toast',
        slots: { title: 'none', description: 'label' },
        toast: { title: 'Title', description: 'Saved' },
        labelledby: 'description',
        describedby: undefined,
      },
      {
        name: 'an empty description element describes nothing',
        slots: { title: 'label', description: 'label' },
        toast: { title: 'Title' },
        labelledby: 'title',
        describedby: undefined,
      },
      {
        name: 'a description element with a text of the developer describes a toast with no description',
        slots: { title: 'label', description: 'text' },
        toast: { title: 'Title' },
        labelledby: 'title',
        describedby: 'description',
      },
      {
        name: 'a description slot with no element describes nothing',
        slots: { title: 'label', description: 'none' },
        toast: { title: 'Title', description: 'Saved' },
        labelledby: 'title',
        describedby: undefined,
      },
    ] as const)('$name', async ({ slots, toast, labelledby, describedby }) => {
      const labels = await mountLabels(slots, toast);
      const id = (label: 'title' | 'description' | undefined) => label && labels[label]!.id;
      expect(labels.root.getAttribute('aria-labelledby') ?? undefined).toBe(id(labelledby));
      expect(labels.root.getAttribute('aria-describedby') ?? undefined).toBe(id(describedby));
      // The slots render also when the toast has no such label.
      if (slots.title !== 'none') expect(labels.title).not.toBe(null);
      if (slots.description !== 'none') expect(labels.description).not.toBe(null);
      expect(labels.root.querySelector('button')).toHaveTextContent('Undo');
    });

    test('the root follows a change of the content of the element', async () => {
      const { root, manager, title, description } = await mountLabels(
        { title: 'label', description: 'label' },
        { description: 'Saved' },
      );
      expect(root).toHaveAttribute('aria-labelledby', description!.id);
      manager.update('a', { title: 'Done' });
      await waitFor(() => expect(root).toHaveAttribute('aria-labelledby', title!.id));
      expect(root).toHaveAttribute('aria-describedby', description!.id);
      manager.update('a', { title: '' });
      await waitFor(() => expect(root).toHaveAttribute('aria-labelledby', description!.id));
      expect(root).not.toHaveAttribute('aria-describedby');
    });

    test('the root follows a component in the slot that changes its own content', async () => {
      const heading = reactive({ text: '' });
      const { root, title, description } = await mountLabels(
        { title: 'component', description: 'label' },
        { description: 'Saved' },
        heading,
      );
      expect(root).toHaveAttribute('aria-labelledby', description!.id);
      heading.text = 'Done';
      await waitFor(() => expect(root).toHaveAttribute('aria-labelledby', title!.id));
      heading.text = '';
      await waitFor(() => expect(root).toHaveAttribute('aria-labelledby', description!.id));
    });

    test('the root follows an element that the slot renders after the mount, and that goes', async () => {
      const { root, slots, description } = await mountLabels(
        { title: 'none', description: 'label' },
        { title: 'Title', description: 'Saved' },
      );
      expect(root).toHaveAttribute('aria-labelledby', description!.id);
      slots.title = 'label';
      const title = await waitFor(() => {
        const element = root.querySelector('h3')!;
        expect(root).toHaveAttribute('aria-labelledby', element.id);
        return element;
      });
      expect(title).toHaveTextContent('Title');
      expect(root).toHaveAttribute('aria-describedby', description!.id);
      slots.title = 'none';
      await waitFor(() => expect(root).toHaveAttribute('aria-labelledby', description!.id));
      expect(root).not.toHaveAttribute('aria-describedby');
    });
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
    { name: '`false`', label: false, shown: false },
    { name: '`undefined`', label: undefined, shown: false },
    { name: 'NaN', label: Number.NaN, shown: true },
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
      else {
        expect(root).not.toHaveAttribute('aria-labelledby');
        expect(root).not.toHaveAttribute('aria-describedby');
      }
    },
  );

  test.runIf(rendersVnodes)('a label that is a function renders as a component', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: () => h('strong', 'Bold') });
    expect(toastRoot('a')!.querySelector('h2 > strong')).toHaveTextContent('Bold');
  });

  test('`actionProps` gives the attributes and the listeners of the action', async () => {
    const onClick = vi.fn();
    const { manager } = await mountToasts();
    await added(manager, {
      id: 'a',
      actionProps: { children: 'Undo', onClick, 'aria-label': 'Undo the change' },
    });
    const action = toastRoot('a')!.querySelector('button')!;
    expect(action).toHaveAttribute('aria-label', 'Undo the change');
    await userEvent.click(action);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('the action shows the content of `actionProps.children` over its slot, and its slot with no `actionProps`', async () => {
    const { manager } = await mountToasts({ list: { actionText: 'From the slot' } });
    await added(manager, { id: 'a', actionProps: { children: 'Undo' } }, { id: 'b' });
    expect(toastRoot('a')!.querySelector('button')).toHaveTextContent('Undo');
    expect(toastRoot('b')!.querySelector('button')).toHaveTextContent('From the slot');
  });

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
    list.titleText = '';
    await nextTick();
    expect(root.querySelector('h2')).toBe(null);
    // VUE-99: the description names a toast with no title.
    expect(root).toHaveAttribute('aria-labelledby', root.querySelector('p')!.id);
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

  test('a toast of high priority is an `alertdialog`, hidden from a screen reader and out of the tab order until the focus comes; an alert in the parent of the viewport announces it', async () => {
    const { manager } = await mountToasts();
    await added(manager, {
      id: 'a',
      title: 'Alert',
      description: 'Now',
      priority: 'high',
      actionProps: { children: 'Undo' },
    });
    const root = toastRoot('a')!;
    const [action, close] = root.querySelectorAll('button');
    expect(root).toHaveAttribute('role', 'alertdialog');
    expect(root).toHaveAttribute('aria-hidden', 'true');
    for (const element of [root, action, close]) expect(element).toHaveAttribute('tabindex', '-1');
    await waitFor(() => expect(document.querySelector('[role="alert"]')).not.toBe(null));
    const alert = document.querySelector('[role="alert"]')!;
    expect(alert.parentElement).toBe(viewport().parentElement);
    expect(alert).toHaveAttribute('aria-atomic', 'true');
    expect(alert.textContent).toBe('AlertNow');
    byId('toast-before').focus();
    await pressF6();
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(root).not.toHaveAttribute('aria-hidden'));
    expect(root).toHaveAttribute('tabindex', '0');
    expect(action).not.toHaveAttribute('tabindex');
    expect(close).not.toHaveAttribute('tabindex');
    expect(document.querySelector('[role="alert"]')).toBe(null);
  });

  test('a close of a toast of high priority removes its alert', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'Alert', priority: 'high' });
    await waitFor(() => expect(document.querySelector('[role="alert"]')).not.toBe(null));
    expect(toastRoot('a')).toHaveAttribute('aria-modal', 'false');
    manager.close('a');
    await waitFor(() => expect(document.querySelector('[role="alert"]')).toBe(null));
  });

  test('Close has `aria-hidden` and no tab stop while the stack is collapsed and the focus is not in its toast; Tab reaches it from its toast', async () => {
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    const close = toastRoot('a')!.querySelector('button')!;
    expect(close).toHaveAttribute('aria-hidden', 'true');
    expect(close).toHaveAttribute('tabindex', '-1');
    close.focus();
    await nextTick();
    expect(close).not.toHaveAttribute('aria-hidden');
    expect(close).not.toHaveAttribute('tabindex');
    byId('toast-after').focus();
    await waitFor(() => expect(close).toHaveAttribute('tabindex', '-1'));
    await userEvent.keyboard('{Tab}{Tab}');
    expect(document.activeElement).toBe(close);
  });

  test('VUE-232: a press in a toast of a collapsed stack gives its Close a tab stop, so Tab reaches it', async () => {
    style('[data-id] { padding: 40px }');
    const { manager } = await mountToasts();
    await added(manager, { id: 'a', title: 'A' });
    const root = toastRoot('a')!;
    const close = root.querySelector('button')!;
    await userEvent.click(root, { position: { x: 5, y: 5 } });
    expect(document.activeElement).toBe(root);
    await userEvent.hover(byId('toast-before'));
    await waitFor(() => expect(viewport()).not.toHaveAttribute('data-expanded'));
    expect(close).not.toHaveAttribute('aria-hidden');
    expect(close).not.toHaveAttribute('tabindex');
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(close);
  });

  test('VUE-232: axe-core finds no element under `aria-hidden` that has a tab stop, in a collapsed stack and in an expanded stack with a toast of high priority', async () => {
    const { manager } = await mountToasts();
    await added(
      manager,
      { id: 'a', title: 'A', actionProps: { children: 'Undo' } },
      { id: 'b', title: 'B', priority: 'high', actionProps: { children: 'Undo' } },
    );
    // A toast is a `dialog`, so axe-core counts an open modal and gives such an element as a result
    // to review, not as a violation.
    const results = async () => {
      const { violations, incomplete } = await axe.run(viewport(), {
        runOnly: ['aria-hidden-focus'],
      });
      return [...violations, ...incomplete].flatMap((rule) => rule.nodes.map((node) => node.html));
    };
    expect(await results()).toEqual([]);
    await userEvent.hover(toastRoot('a')!);
    await waitFor(() => expect(viewport()).toHaveAttribute('data-expanded'));
    expect(await results()).toEqual([]);
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

describe('anchored toasts', () => {
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
      expect(found?.style.opacity).toBe('');
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

  test('the arrow is hidden from a screen reader and follows the side of its positioner; a prop of the positioner wins over `positionerProps`, and a key that it does not set comes from them', async () => {
    const { exposed } = mount(ToastAnchored, { positioner: { side: 'left' } });
    await nextTick();
    const manager = exposed.manager as Manager;
    manager.add({
      id: 'a',
      description: 'Copied',
      timeout: 0,
      positionerProps: { anchor: byId('anchor'), side: 'bottom', align: 'end' },
    });
    const arrow = await waitFor(() => {
      const found = document.querySelector('[data-testid="arrow"]');
      expect(found).toHaveAttribute('data-side', 'left');
      return found!;
    });
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    const element = document.querySelector('[data-testid="positioner"]')!;
    expect(element).toHaveAttribute('data-side', 'left');
    expect(element).toHaveAttribute('data-align', 'end');
  });

  test('a positioner in its leave keeps its index, and the toast behind it gets the index 0', async () => {
    style(
      '.toast-leave-active [data-id] { transition: opacity 300ms } .toast-leave-to [data-id] { opacity: 0 }',
    );
    const { exposed } = mount(ToastAnchored, { group: { duration: 300 } });
    await nextTick();
    const manager = exposed.manager as Manager;
    for (const id of ['oldest', 'newest']) {
      manager.add({ id, description: id, timeout: 0, positionerProps: { anchor: byId('anchor') } });
    }
    await waitFor(() =>
      expect(document.querySelectorAll('[data-testid="positioner"]')).toHaveLength(2),
    );
    const [newest, oldest] = document.querySelectorAll<HTMLElement>('[data-testid="positioner"]');
    expect(newest!.style.getPropertyValue('--toast-index')).toBe('0');
    expect(oldest!.style.getPropertyValue('--toast-index')).toBe('1');
    manager.close('newest');
    await nextTick();
    expect(newest!.isConnected).toBe(true);
    expect(newest!.style.getPropertyValue('--toast-index')).toBe('0');
    expect(oldest!.style.getPropertyValue('--toast-index')).toBe('0');
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
    for (const part of ['Viewport', 'Positioner']) {
      expect(String(mountError(ToastPartAlone, { part }))).toContain(
        `<Toast.${part}> must be inside <Toast.Provider>`,
      );
    }
    expect(String(mountError(ToastPartAlone, { part: 'Description', inProvider: true }))).toContain(
      '<Toast.Description> must be inside <Toast.Root>',
    );
    expect(String(mountError(ToastPartAlone, { part: 'Arrow', inProvider: true }))).toContain(
      '<Toast.Arrow> must be inside <Toast.Positioner>',
    );
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  });
});
