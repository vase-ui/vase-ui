import {
  computed,
  inject,
  onMounted,
  onUnmounted,
  provide,
  shallowRef,
  watch,
  type InjectionKey,
} from 'vue';
import { useIsHydrated } from '../common/hydration';
import { nextToastId } from './manager';
import type {
  ToastManagerAddOptions,
  ToastManagerEvent,
  ToastManagerPromiseOptions,
  ToastManagerUpdateOptions,
  ToastObject,
  ToastProviderProps,
  UseToastManagerReturnValue,
} from './types';

/** What `Toast.Viewport` gives to its provider. */
export interface ToastViewportOfProvider {
  readonly element: HTMLElement | null;
  /** The element that had the focus before F6 moved it to the viewport. */
  readonly origin: Element | null;
  /** Moves the focus to the origin. Gives `true` when the focus is then outside the viewport. */
  returnFocus(): boolean;
}

/** The interaction state that stops the timers. */
export interface ToastInteraction {
  hover?: boolean;
  focus?: boolean;
  windowFocused?: boolean;
  hidden?: boolean;
}

/** What `Toast.Provider` gives to its parts and to `useToastManager`. The properties are reactive. */
export interface ToastProviderForParts extends Omit<UseToastManagerReturnValue, 'toasts'> {
  /** The open toasts, the newest first. */
  readonly toasts: readonly ToastObject[];
  /** The pointer or the keyboard focus is in the viewport. */
  readonly expanded: boolean;
  /** The keyboard focus is in the viewport. */
  readonly focused: boolean;
  /** The number of roots in their leave. */
  readonly leaving: number;
  /** The index of the toast in the list, and the heights of the toasts before it. */
  place(id: string): { readonly index: number; readonly offsetY: number };
  setHeight(id: string, height: number): void;
  addRoot(root: { readonly id: string; readonly element: HTMLElement | null }): () => void;
  /** The element of the mounted root of the open toast with the id. */
  rootElement(id: string): HTMLElement | null;
  /** Counts a root in its leave. The result ends it. */
  addLeaving(): () => void;
  /** Sets the viewport. The result removes it. */
  setViewport(viewport: ToastViewportOfProvider): () => void;
  setInteraction(state: ToastInteraction): void;
}

interface Timer {
  delay: number;
  remaining: number;
  start: number;
  handle: ReturnType<typeof setTimeout> | undefined;
}

const providerKey: InjectionKey<ToastProviderForParts> = Symbol('toast provider');

/** Holds the toasts of a provider and their timers. Call it in the `setup` of `Toast.Provider`. */
export function useToastProvider(
  props: Required<Pick<ToastProviderProps, 'timeout' | 'limit'>> & ToastProviderProps,
) {
  const list = shallowRef<readonly ToastObject[]>([]);
  // The methods read this copy, which Vue does not track, so that an effect that calls a method
  // does not run again at each change of the list.
  let current: readonly ToastObject[] = [];
  let { timeout, limit } = props;
  const hover = shallowRef(false);
  const focus = shallowRef(false);
  const leaving = shallowRef(0);
  let windowFocused = true;
  let hidden = false;
  let mounted = false;
  const viewport = shallowRef<ToastViewportOfProvider | null>(null);
  const roots = new Set<{ readonly id: string; readonly element: HTMLElement | null }>();
  const timers = new Map<string, Timer>();
  let running = false;

  // A part below that adds a toast in the same update gets the new values.
  watch(
    () => [props.timeout, props.limit] as const,
    ([nextTimeout, nextLimit]) => {
      timeout = nextTimeout;
      if (nextLimit === limit) return;
      limit = nextLimit;
      setList(current);
    },
  );

  function setList(next: readonly ToastObject[]) {
    current = next.map((toast, index) => {
      const limited = index >= limit;
      return toast.limited === limited ? toast : { ...toast, limited };
    });
    list.value = current;
    if (current.length === 0) setInteraction({ hover: false, focus: false });
  }

  function find(id: string) {
    return current.find((toast) => toast.id === id);
  }

  function syncTimers() {
    const run = mounted && !hover.value && !focus.value && windowFocused && !hidden;
    if (run === running) return;
    running = run;
    for (const [id, timer] of timers) {
      if (run) startTimer(id, timer);
      else stopTimer(timer);
    }
  }

  function startTimer(id: string, timer: Timer) {
    if (timer.remaining <= 0) timer.remaining = timer.delay;
    timer.start = Date.now();
    timer.handle = setTimeout(() => {
      timers.delete(id);
      close(id);
    }, timer.remaining);
  }

  function stopTimer(timer: Timer) {
    if (timer.handle === undefined) return;
    clearTimeout(timer.handle);
    timer.handle = undefined;
    timer.remaining = Math.max(timer.remaining - (Date.now() - timer.start), 0);
  }

  function clearTimer(id: string) {
    const timer = timers.get(id);
    if (timer?.handle !== undefined) clearTimeout(timer.handle);
    timers.delete(id);
  }

  function setTimer(toast: ToastObject) {
    clearTimer(toast.id);
    const delay = toast.timeout ?? timeout;
    if (toast.type === 'loading' || !(delay > 0)) return;
    const timer: Timer = { delay, remaining: delay, start: 0, handle: undefined };
    timers.set(toast.id, timer);
    if (running) startTimer(toast.id, timer);
  }

  function add(options: ToastManagerAddOptions): string {
    const id = options.id || nextToastId();
    if (find(id)) {
      write(id, options, true);
      return id;
    }
    const toast: ToastObject = { ...options, id, updateKey: 0 };
    setList([toast, ...current]);
    setTimer(toast);
    return id;
  }

  function update(
    id: string,
    options: ToastManagerUpdateOptions | ((toast: ToastObject) => ToastManagerUpdateOptions),
  ) {
    const toast = find(id);
    if (!toast) return;
    write(id, typeof options === 'function' ? options(toast) : options, false);
  }

  function write(
    id: string,
    options: ToastManagerUpdateOptions & { id?: unknown },
    restart: boolean,
  ) {
    // The function of `update` can change the list.
    const previous = find(id);
    if (!previous) return;
    const { id: _id, ...changes } = options;
    const next: ToastObject = { ...previous, ...changes, updateKey: (previous.updateKey ?? 0) + 1 };
    setList(current.map((toast) => (toast === previous ? next : toast)));
    const delay = next.timeout ?? timeout;
    if (next.type === 'loading' || !(delay > 0)) clearTimer(id);
    else if (
      restart ||
      Object.hasOwn(changes, 'timeout') ||
      previous.type === 'loading' ||
      !timers.has(id)
    ) {
      setTimer(next);
    }
  }

  function close(id?: string) {
    const before = current;
    const closing = id === undefined ? before : before.filter((toast) => toast.id === id);
    const [first] = closing;
    if (!first) return;
    const index = id === undefined ? -1 : before.indexOf(first);
    const element = id === undefined ? viewport.value?.element : rootElement(id);
    for (const toast of closing) clearTimer(toast.id);
    setList(id === undefined ? [] : before.filter((toast) => toast.id !== id));
    for (const toast of closing) toast.onClose?.();
    for (const toast of closing) {
      const mountedRoot = [...roots].some((root) => root.id === toast.id);
      if (!mountedRoot && !find(toast.id)) toast.onRemove?.();
    }
    moveFocus(element, id === undefined ? null : before.slice(index + 1));
  }

  /**
   * Moves a focus of the keyboard out of the closed toast: to the next older toast that is not
   * inert, else to the next newer one, else to the origin of the viewport. A close of each toast
   * moves it to the origin.
   */
  function moveFocus(closed: Element | null | undefined, older: readonly ToastObject[] | null) {
    const active = closed?.ownerDocument.activeElement;
    if (!closed || !active || !closed.contains(active) || !active.matches(':focus-visible')) return;
    const olderIds = new Set(older?.map((toast) => toast.id));
    const newer = current.filter((toast) => !olderIds.has(toast.id)).reverse();
    const next = older
      ? [...current.filter((toast) => olderIds.has(toast.id)), ...newer]
          .map((toast) => rootElement(toast.id))
          .find((element) => element && !element.inert)
      : null;
    if (next) next.focus();
    else if (viewport.value?.origin) viewport.value.returnFocus();
    // Firefox and WebKit send no `focusout` when the focused element leaves the document, so the
    // viewport keeps its focus state (test/measurements/toast.test.ts).
    else (active as HTMLElement).blur();
  }

  function promise<Value>(value: Promise<Value>, options: ToastManagerPromiseOptions<Value>) {
    const id = add({ ...optionsOf(options.loading), type: 'loading' });
    const handled = value
      .then((result) => {
        const changes = optionsOf(options.success, result);
        update(id, { ...changes, type: 'success', timeout: changes.timeout });
        return result;
      })
      .catch((error: unknown) => {
        const changes = optionsOf(options.error, error);
        update(id, { ...changes, type: 'error', timeout: changes.timeout });
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- The promise of the caller gave this reason.
        return Promise.reject(error);
      });
    // `createToastManager` gives each provider this function.
    if (Object.hasOwn(options, 'setPromise')) {
      (options as unknown as { setPromise: (handled: Promise<Value>) => void }).setPromise(handled);
    }
    return handled;
  }

  const places = computed(() => {
    const result = new Map<string, { index: number; offsetY: number }>();
    let offsetY = 0;
    list.value.forEach((toast, index) => {
      result.set(toast.id, { index, offsetY });
      offsetY += toast.height ?? 0;
    });
    return result;
  });

  function rootElement(id: string) {
    for (const root of roots) {
      if (root.id === id && root.element?.isConnected) return root.element;
    }
    return null;
  }

  function setInteraction(state: ToastInteraction) {
    if (state.hover !== undefined) hover.value = state.hover;
    if (state.focus !== undefined) focus.value = state.focus;
    if (state.windowFocused !== undefined) windowFocused = state.windowFocused;
    if (state.hidden !== undefined) hidden = state.hidden;
    syncTimers();
  }

  function onManagerEvent({ action, options }: ToastManagerEvent) {
    // The manager waits for the promise of each provider.
    if (action === 'promise') void promise(options.promise, options);
    else if (action === 'update') update(options.id, options.updates);
    else if (action === 'close') close(options.id);
    else add(options);
  }

  // A server mounts no provider, so a manager that each request shares gets no toast of a request,
  // and no timer starts there.
  onMounted(() => {
    mounted = true;
    syncTimers();
    watch(
      () => props.toastManager,
      (manager, _, onCleanup) => {
        if (manager) onCleanup(manager[' subscribe'](onManagerEvent));
      },
      { immediate: true },
    );
  });
  onUnmounted(() => {
    mounted = false;
    syncTimers();
  });

  const context: ToastProviderForParts = {
    get toasts() {
      return list.value;
    },
    get expanded() {
      return hover.value || focus.value;
    },
    get focused() {
      return focus.value;
    },
    get leaving() {
      return leaving.value;
    },
    add,
    update,
    close,
    promise,
    place: (id) => places.value.get(id) ?? { index: -1, offsetY: 0 },
    setHeight(id, height) {
      const toast = find(id);
      if (!toast || toast.height === height) return;
      setList(current.map((each) => (each === toast ? { ...toast, height } : each)));
    },
    addRoot(root) {
      roots.add(root);
      return () => roots.delete(root);
    },
    rootElement,
    addLeaving() {
      leaving.value += 1;
      let ended = false;
      return () => {
        if (ended) return;
        ended = true;
        leaving.value -= 1;
      };
    },
    setViewport(next) {
      viewport.value = next;
      return () => {
        if (viewport.value === next) viewport.value = null;
      };
    },
    setInteraction,
  };
  provide(providerKey, context);

  // The viewport is a polite live region, so the provider renders the alerts of the toasts of high
  // priority in the parent of the viewport, after the mount.
  const hydrated = useIsHydrated();
  const alertTarget = computed(() =>
    hydrated.value ? (viewport.value?.element?.parentNode as Element | null | undefined) : null,
  );
  const alerts = computed(() =>
    focus.value ? [] : list.value.filter((toast) => toast.priority === 'high'),
  );
  return { alertTarget, alerts };
}

function optionsOf<Value>(
  options:
    string | ToastManagerUpdateOptions | ((value: Value) => string | ToastManagerUpdateOptions),
  value?: Value,
): ToastManagerUpdateOptions {
  const given = typeof options === 'function' ? options(value as Value) : options;
  return typeof given === 'string' ? { description: given } : given;
}

/** The provider of the part. A part with no provider throws an error that names it. */
export function injectToastProvider(part: string) {
  const provider = inject(providerKey, null);
  if (!provider) {
    throw new Error(
      `Vase UI: ${part} must be inside <Toast.Provider>. Without a provider the part has no toasts. Put the part inside <Toast.Provider>.`,
    );
  }
  return provider;
}

/** Gives the open toasts of the nearest provider and the methods that change them. */
export function useToastManager<Data extends object = any>(): UseToastManagerReturnValue<Data> {
  const provider = injectToastProvider('Toast.useToastManager()');
  return {
    toasts: computed(() => provider.toasts as ToastObject<Data>[]),
    add: provider.add,
    update: provider.update,
    close: provider.close,
    promise: provider.promise,
  };
}
