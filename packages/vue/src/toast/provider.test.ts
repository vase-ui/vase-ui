import { afterEach, describe, expect, onTestFinished, test, vi } from 'vitest';
import { nextTick, reactive } from 'vue';
import { Toast } from '@vase-ui/vue/toast';
import ToastProviders from '../../test/fixtures/ToastProviders.vue';
import { flushMicrotasks } from '../../test/flushMicrotasks';
import { takeReportedMessages } from '../../test/reportedMessages';
import { mount } from '../../test/render';
import type { ToastProviderForParts } from './provider';

type Props = Record<string, unknown>;

async function mountProviders(props: Props = {}) {
  const { exposed, unmount } = mount(ToastProviders, props);
  await nextTick();
  return { provider: exposed.provider as ToastProviderForParts, unmount };
}

const ids = (provider: ToastProviderForParts) => provider.toasts.map((toast) => toast.id);

async function advance(ms: number) {
  vi.advanceTimersByTime(ms);
  await nextTick();
}

afterEach(() => {
  vi.useRealTimers();
});

describe('the list with no viewport', () => {
  test('VUE-30: `close` closes a toast and calls `onClose` while the provider has no viewport', async () => {
    const { provider } = await mountProviders();
    const onClose = vi.fn();
    provider.add({ id: 'a', onClose });
    provider.close('a');
    expect(ids(provider)).toEqual([]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('`close` calls `onRemove` at once for a toast with no mounted root', async () => {
    const { provider } = await mountProviders();
    const log: string[] = [];
    provider.add({ id: 'a', onClose: () => log.push('close'), onRemove: () => log.push('remove') });
    provider.close('a');
    expect(log).toEqual(['close', 'remove']);
  });

  test('a change of `timeout` and `limit` holds for a part that adds a toast in the same update', async () => {
    const props = reactive({ timeout: 5000, limit: 3 });
    const add = reactive({ key: 0 });
    const { provider } = await mountProviders({ provider: props, add });
    provider.add({ id: 'first' });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    props.timeout = 100;
    props.limit = 1;
    add.key = 1;
    await nextTick();
    expect(ids(provider)).toEqual(['added-1', 'first']);
    expect(provider.toasts.map((toast) => toast.limited)).toEqual([false, true]);
    await advance(150);
    expect(ids(provider)).toEqual(['first']);
  });
});

describe('the timers', () => {
  test('stop with the time that is left, and start again; a timer that stops with no time left gets its full time', async () => {
    const { provider } = await mountProviders();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    provider.add({ id: 'a', timeout: 1000 });
    await advance(600);
    provider.setInteraction({ hover: true });
    await advance(5000);
    expect(ids(provider)).toEqual(['a']);
    provider.setInteraction({ hover: false });
    await advance(350);
    expect(ids(provider)).toEqual(['a']);
    vi.setSystemTime(Date.now() + 100);
    provider.setInteraction({ windowFocused: false });
    provider.setInteraction({ windowFocused: true });
    await advance(900);
    expect(ids(provider)).toEqual(['a']);
    await advance(150);
    expect(ids(provider)).toEqual([]);
  });

  test('each of hover, focus, a window with no focus and a hidden page stops them', async () => {
    const { provider } = await mountProviders();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    for (const state of [
      { hover: true },
      { focus: true },
      { windowFocused: false },
      { hidden: true },
    ]) {
      provider.add({ id: 'a', timeout: 100 });
      provider.setInteraction(state);
      await advance(500);
      expect(ids(provider)).toEqual(['a']);
      provider.setInteraction({ hover: false, focus: false, windowFocused: true, hidden: false });
      await advance(150);
      expect(ids(provider)).toEqual([]);
    }
  });

  test('stop at the unmount of the provider', async () => {
    const { provider, unmount } = await mountProviders();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const onClose = vi.fn();
    provider.add({ id: 'a', timeout: 100, onClose });
    unmount();
    await advance(500);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('a manager', () => {
  test('adds to each mounted provider from the mount to the unmount, and follows a change of the prop; with no mounted provider it keeps no toast', async () => {
    const first = Toast.createToastManager();
    first.add({ id: 'before' });
    const props = reactive<Props>({ toastManager: first });
    const { provider, unmount } = await mountProviders({ count: 2, provider: props });
    expect(ids(provider)).toEqual([]);
    first.add({ id: 'a' });
    first.update('a', { title: 'A' });
    expect(provider.toasts[0]).toMatchObject({ id: 'a', title: 'A' });
    const second = Toast.createToastManager();
    props.toastManager = second;
    await nextTick();
    first.add({ id: 'b' });
    second.add({ id: 'c' });
    expect(ids(provider)).toEqual(['c', 'a']);
    second.close('c');
    expect(ids(provider)).toEqual(['a']);
    unmount();
    second.add({ id: 'd' });
    expect(ids(provider)).toEqual(['a']);
  });

  describe('VUE-90: one manager in more than one provider', () => {
    const options = { loading: 'Loading', success: 'Success', error: 'Error' };

    // The browser reports the rejections with no handler in their sequence. The rejection of the
    // case comes after the action, so its report comes after each report of the action.
    async function rejectionsWithNoHandler(action: () => void) {
      const reported: Promise<unknown>[] = [];
      let rejectLast!: (reason: unknown) => void;
      const last = new Promise<never>((_, reject) => (rejectLast = reject));
      let lastReported!: () => void;
      const done = new Promise<void>((resolve) => (lastReported = resolve));
      const record = ({ promise }: PromiseRejectionEvent) => {
        reported.push(promise);
        if (promise === last) lastReported();
      };
      window.addEventListener('unhandledrejection', record);
      onTestFinished(() => window.removeEventListener('unhandledrejection', record));
      action();
      await flushMicrotasks();
      rejectLast(new Error('The last rejection of the case.'));
      await done;
      // Vitest writes each report to the console while a test has a listener for the report.
      expect(takeReportedMessages()).toEqual(
        reported.map(() => 'console.error: [object PromiseRejectionEvent]'),
      );
      return reported.slice(0, -1);
    }

    test.each([
      { name: 'no provider', count: 0 },
      { name: 'one provider', count: 1 },
      { name: 'two providers', count: 2 },
    ])('a rejection that the caller handles gives no report: $name', async ({ count }) => {
      const manager = Toast.createToastManager();
      mount(ToastProviders, { count, provider: { toastManager: manager } });
      await nextTick();
      const reason = new Error('reason');
      let caught: unknown;
      const reported = await rejectionsWithNoHandler(() => {
        manager.promise(Promise.reject(reason), options).catch((error: unknown) => {
          caught = error;
        });
      });
      expect(caught).toBe(reason);
      expect(reported).toEqual([]);
    });

    test.each([
      { name: 'no provider', count: 0 },
      { name: 'one provider', count: 1 },
      { name: 'two providers', count: 2 },
    ])(
      'a rejection with no handler gives one report, of the returned promise: $name',
      async ({ count }) => {
        const manager = Toast.createToastManager();
        mount(ToastProviders, { count, provider: { toastManager: manager } });
        await nextTick();
        let returned: Promise<unknown> | undefined;
        const reported = await rejectionsWithNoHandler(() => {
          returned = manager.promise(Promise.reject(new Error('reason')), options);
        });
        expect(reported.map((promise) => promise === returned)).toEqual([true]);
      },
    );

    test.each([
      { name: 'no provider', count: 0 },
      { name: 'one provider', count: 1 },
      { name: 'two providers', count: 2 },
    ])('the returned promise has the value: $name', async ({ count }) => {
      const manager = Toast.createToastManager();
      mount(ToastProviders, { count, provider: { toastManager: manager } });
      await nextTick();
      await expect(manager.promise(Promise.resolve('value'), options)).resolves.toBe('value');
    });

    test.each([
      { name: 'one provider', count: 1 },
      { name: 'two providers', count: 2 },
    ])(
      'an error of the `success` function rejects the returned promise: $name',
      async ({ count }) => {
        const manager = Toast.createToastManager();
        mount(ToastProviders, { count, provider: { toastManager: manager } });
        await nextTick();
        const error = new Error('success');
        await expect(
          manager.promise(Promise.resolve('value'), {
            ...options,
            success: () => {
              throw error;
            },
          }),
        ).rejects.toBe(error);
      },
    );
  });
});
