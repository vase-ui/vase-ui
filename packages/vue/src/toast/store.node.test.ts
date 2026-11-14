import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, watch, watchEffect } from 'vue';
import { ToastStore, selectors } from './store';

function createStore() {
  return new ToastStore({
    toasts: [],
    timeout: 0,
    limit: 3,
    hovering: false,
    focused: false,
    isWindowFocused: true,
    viewport: null,
    prevFocusElement: null,
  });
}

describe('ToastStore with no DOM', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('VUE-30: closes one toast and all toasts while the store has no viewport', () => {
    const onClose = vi.fn();
    const store = createStore();
    store.addToast({ id: 'a', onClose });
    store.addToast({ id: 'b', onClose });
    store.addToast({ id: 'c', onClose });

    store.closeToast('b');

    expect(selectors.toast(store.state, 'b')?.transitionStatus).toBe('ending');

    store.closeToast();

    expect(store.state.toasts.map((toast) => toast.transitionStatus)).toEqual([
      'ending',
      'ending',
      'ending',
    ]);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('VUE-30: closes a toast from its timer while the store has no viewport', () => {
    vi.useFakeTimers();
    const store = createStore();
    store.addToast({ id: 'a', timeout: 100 });

    vi.advanceTimersByTime(100);

    expect(selectors.toast(store.state, 'a')?.transitionStatus).toBe('ending');
  });

  it('lets a computed follow the list and the place of each toast', () => {
    const store = createStore();
    const ids = computed(() => store.select('toasts').map((toast) => toast.id));
    const indexOfA = computed(() => store.select('toastIndex', 'a'));
    const visibleIndexOfA = computed(() => store.select('toastVisibleIndex', 'a'));
    expect(ids.value).toEqual([]);
    expect(indexOfA.value).toBe(-1);

    store.addToast({ id: 'a' });
    store.addToast({ id: 'b' });

    expect(ids.value).toEqual(['b', 'a']);
    expect(indexOfA.value).toBe(1);
    expect(visibleIndexOfA.value).toBe(1);

    store.closeToast('b');

    expect(indexOfA.value).toBe(1);
    expect(visibleIndexOfA.value).toBe(0);
  });

  it('keeps the place of each toast equal to the list while a sync watcher closes a toast', () => {
    const onClose = vi.fn();
    const store = createStore();
    const stop = watch(
      () => store.select('toasts'),
      (toasts) => {
        for (const olderToast of toasts.slice(1)) {
          if (olderToast.transitionStatus !== 'ending') {
            store.closeToast(olderToast.id);
          }
        }
      },
      { flush: 'sync' },
    );
    store.addToast({ id: 'a', onClose });

    store.addToast({ id: 'b' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(selectors.toast(store.state, 'a')).toBe(store.state.toasts[1]);

    store.closeToast('a');

    expect(onClose).toHaveBeenCalledTimes(1);
    stop();
  });

  it('starts the timer of a toast that a sync watcher adds as the last toast closes during a hover', () => {
    vi.useFakeTimers();
    const store = createStore();
    store.addToast({ id: 'a' });
    store.set('hovering', true);
    let added = false;
    const stop = watch(
      () => store.select('toasts'),
      (toasts) => {
        if (!added && toasts.every((toast) => toast.transitionStatus === 'ending')) {
          added = true;
          store.addToast({ id: 'next', timeout: 100 });
        }
      },
      { flush: 'sync' },
    );

    store.closeToast('a');
    vi.advanceTimersByTime(100);

    expect(selectors.toast(store.state, 'next')?.transitionStatus).toBe('ending');
    stop();
  });

  it('applies the new limit to a toast that a sync watcher adds while the limit changes', () => {
    const store = createStore();
    store.addToast({ id: 'a' });
    store.addToast({ id: 'b' });
    store.addToast({ id: 'c' });
    let added = false;
    const stop = watch(
      () => store.select('toasts'),
      () => {
        if (!added) {
          added = true;
          store.addToast({ id: 'd' });
        }
      },
      { flush: 'sync' },
    );

    store.syncProviderProps(0, 1);

    expect(store.state.toasts.map((toast) => [toast.id, toast.limited])).toEqual([
      ['d', false],
      ['c', true],
      ['b', true],
      ['a', true],
    ]);
    stop();
  });

  it('keeps what a sync watcher writes to another key while the first keys are written', () => {
    const store = createStore();
    const stop = watch(
      () => store.select('expanded'),
      () => store.set('isWindowFocused', false),
      { flush: 'sync' },
    );

    store.set('hovering', true);

    expect(store.state.isWindowFocused).toBe(false);
    stop();
  });

  it.each([
    { name: 'addToast', call: (store: ToastStore) => store.addToast({ id: 'effect' }) },
    {
      name: 'updateToast',
      call: (store: ToastStore) => store.updateToast('first', { title: 'Updated' }),
    },
    {
      name: 'updateToast with a function',
      call: (store: ToastStore) => store.updateToast('first', () => ({ title: 'Updated' })),
    },
    { name: 'closeToast', call: (store: ToastStore) => store.closeToast('first') },
    { name: 'closeToast with no id', call: (store: ToastStore) => store.closeToast() },
    { name: 'removeToast', call: (store: ToastStore) => store.removeToast('first') },
    {
      name: 'promiseToast',
      call: (store: ToastStore) =>
        void store.promiseToast(new Promise<void>(() => {}), {
          loading: { id: 'effect' },
          success: 'Done',
          error: 'Failed',
        }),
    },
    { name: 'syncProviderProps', call: (store: ToastStore) => store.syncProviderProps(100, 1) },
  ])('lets an effect call $name with no dependency on the state', ({ call }) => {
    const store = createStore();
    store.addToast({ id: 'first' });
    let runs = 0;

    const stop = watchEffect(
      () => {
        runs += 1;
        call(store);
      },
      { flush: 'sync' },
    );

    expect(runs).toBe(1);

    store.addToast({ id: 'later' });
    store.updateToast('later', { title: 'Later' });
    store.set('hovering', true);
    store.set('isWindowFocused', false);
    store.syncProviderProps(200, 2);
    store.closeToast('later');
    store.removeToast('later');

    expect(runs).toBe(1);
    stop();
  });
});
