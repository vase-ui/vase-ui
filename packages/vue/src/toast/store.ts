import { toRaw } from 'vue';
import { generateId } from '../common/generateId';
import { ownerDocument } from '../common/owner';
import { activeElement, contains, getTarget } from '../common/shadowDom';
import { Timeout } from '../common/useTimeout';
import { ReactiveStore } from '../utils/popups/ReactiveStore';
import type {
  ToastManagerAddOptions,
  ToastManagerPromiseOptions,
  ToastManagerUpdateOptions,
  ToastObject,
} from './useToastManager';
import { isFocusVisible } from './utils/focusVisible';
import { resolvePromiseOptions } from './utils/resolvePromiseOptions';

type ToastInternalUpdateOptions<Data extends object> = Partial<
  Omit<ToastObject<Data>, 'id' | 'updateKey'>
>;

/**
 * A toast once it lives in the store. `addToast` is the only way in and it always
 * assigns `updateKey`, so unlike the public `ToastObject` it is never missing.
 */
export type StoredToast<Data extends object = any> = ToastObject<Data> & { updateKey: number };

export type State = {
  toasts: StoredToast[];
  hovering: boolean;
  focused: boolean;
  timeout: number;
  limit: number;
  isWindowFocused: boolean;
  viewport: HTMLElement | null;
  prevFocusElement: HTMLElement | null;
};

type ToastMetadata = {
  value: StoredToast;
  domIndex: number;
  visibleIndex: number;
  offsetY: number;
};

function createToastMetadata(toasts: StoredToast[]) {
  const metadata = new Map<string, ToastMetadata>();
  let visibleIndex = 0;
  let offsetY = 0;

  toasts.forEach((toast, toastIndex) => {
    const isEnding = toast.transitionStatus === 'ending';
    metadata.set(toast.id, {
      value: toast,
      domIndex: toastIndex,
      visibleIndex: isEnding ? -1 : visibleIndex,
      offsetY,
    });

    offsetY += toast.height || 0;

    if (!isEnding) {
      visibleIndex += 1;
    }
  });

  return metadata;
}

// The metadata comes from the list, not from a second key of the state. A second key is a second
// write, so a `flush: 'sync'` watcher could read a list and metadata that disagree.
const metadataOfToasts = new WeakMap<StoredToast[], Map<string, ToastMetadata>>();

function getToastMetadata(toasts: StoredToast[]) {
  let metadata = metadataOfToasts.get(toasts);
  if (!metadata) {
    metadata = createToastMetadata(toasts);
    metadataOfToasts.set(toasts, metadata);
  }
  return metadata;
}

// Marks the active (non-ending) toasts beyond `limit` as limited. Callers pass
// toasts in newest-first order, so the newest `limit` toasts stay visible and
// the rest are flagged. Returns the same toast reference when its `limited`
// flag is unchanged to avoid unnecessary re-renders.
function applyLimited(toasts: StoredToast[], limit: number): StoredToast[] {
  let activeIndex = 0;
  return toasts.map((toast) => {
    if (toast.transitionStatus === 'ending') {
      return toast;
    }
    const limited = activeIndex >= limit;
    activeIndex += 1;
    return toast.limited === limited ? toast : { ...toast, limited };
  });
}

export const selectors = {
  toasts: (state: State) => state.toasts,
  isEmpty: (state: State) => state.toasts.length === 0,
  toast: (state: State, id: string) => getToastMetadata(state.toasts).get(id)?.value,
  toastIndex: (state: State, id: string) => getToastMetadata(state.toasts).get(id)?.domIndex ?? -1,
  toastOffsetY: (state: State, id: string) => getToastMetadata(state.toasts).get(id)?.offsetY ?? 0,
  toastVisibleIndex: (state: State, id: string) =>
    getToastMetadata(state.toasts).get(id)?.visibleIndex ?? -1,
  focused: (state: State) => state.focused,
  expanded: (state: State) => state.hovering || state.focused,
  expandedOrOutOfFocus: (state: State) => state.hovering || state.focused || !state.isWindowFocused,
  prevFocusElement: (state: State) => state.prevFocusElement,
};

export class ToastStore extends ReactiveStore<State, {}, typeof selectors> {
  private timers = new Map<string, TimerInfo>();

  private areTimersPaused = false;

  /**
   * Whether the provider released its timers, for example while `KeepAlive` holds it.
   * Timers don't run while suspended, independently of the hover/focus pause in `areTimersPaused`.
   */
  private areTimersSuspended = false;

  constructor(initialState: State) {
    super({ ...initialState }, {}, selectors);
  }

  /**
   * The state with no dependency tracking. Each method reads it, so an effect of the consumer
   * that calls a method, such as a `watchEffect` that adds a toast, does not run again when the
   * toasts change.
   */
  private get current(): State {
    return toRaw(this.state);
  }

  /**
   * Writes `toasts` after the other keys. A sync watcher of the toasts then reads the limit and the
   * interaction state of the same change.
   */
  override setState(newState: State): void {
    super.setState({ ...newState, toasts: this.current.toasts });
    // A sync watcher can write the other keys in the first pass. This pass starts from the state of
    // now, so that it keeps those writes.
    super.setState({ ...this.current, toasts: newState.toasts });
  }

  setViewport = (viewport: HTMLElement | null) => {
    this.set('viewport', viewport);
  };

  syncProviderProps(timeout: number, limit: number) {
    const limitChanged = this.current.limit !== limit;

    if (this.current.timeout === timeout && !limitChanged) {
      return;
    }

    const updates = { timeout, limit } as Pick<State, 'timeout' | 'limit' | 'toasts'>;

    if (limitChanged) {
      updates.toasts = applyLimited(this.current.toasts, limit);
    }

    this.update(updates);
  }

  disposeEffect = () => {
    // The cleanup also runs while `KeepAlive` keeps the store alive, so when the effect
    // runs again, resume the timers with their remaining time unless an interaction pauses them.
    if (this.areTimersSuspended) {
      this.areTimersSuspended = false;
      if (!this.areTimersPaused) {
        this.startTimers();
      }
    }

    return () => {
      this.areTimersSuspended = true;
      this.stopTimers();
    };
  };

  removeToast(toastId: string, skipOnRemove = false) {
    const index = selectors.toastIndex(this.current, toastId);
    if (index === -1) {
      return;
    }

    const toast = this.current.toasts[index];
    if (!skipOnRemove) {
      toast?.onRemove?.();
    }

    const newToasts = [...this.current.toasts];
    newToasts.splice(index, 1);
    this.setToasts(newToasts);
  }

  addToast = <Data extends object>(toast: ToastManagerAddOptions<Data>): string => {
    const { timeout, limit } = this.current;
    const id = toast.id || generateId('toast');

    if (toast.id) {
      const existingToast = selectors.toast(this.current, toast.id);

      if (existingToast) {
        if (existingToast.transitionStatus === 'ending') {
          this.removeToast(toast.id, true);
        } else {
          const { id: ignoredId, transitionStatus: ignoredTransitionStatus, ...updates } = toast;
          this.updateToastInternal(toast.id, updates, true, true);
          return toast.id;
        }
      }
    }

    const toastToAdd: StoredToast<Data> = {
      ...toast,
      id,
      updateKey: 0,
      transitionStatus: 'starting',
    };

    const updatedToasts = [toastToAdd, ...this.current.toasts];
    this.setToasts(applyLimited(updatedToasts, limit));

    const duration = toastToAdd.timeout ?? timeout;
    if (toastToAdd.type !== 'loading' && duration > 0) {
      this.scheduleTimer(id, duration, () => this.closeToast(id));
    }

    if (selectors.expandedOrOutOfFocus(this.current)) {
      this.pauseTimers();
    }

    return id;
  };

  updateToast = <Data extends object>(
    id: string,
    updates:
      | ToastManagerUpdateOptions<Data>
      | ((prevToast: ToastObject<Data>) => ToastManagerUpdateOptions<Data>),
  ) => {
    const prevToast = selectors.toast(this.current, id);
    // Never run the updater for an update the store is going to ignore.
    if (!prevToast || prevToast.transitionStatus === 'ending') {
      return;
    }

    // The updater may have called back into the store, so the internal update
    // reads the current state again.
    this.updateToastInternal(
      id,
      typeof updates === 'function' ? updates(prevToast) : updates,
      false,
      true,
    );
  };

  updateToastInternal = <Data extends object>(
    id: string,
    updates: ToastInternalUpdateOptions<Data>,
    resetTimer = false,
    markUpdated = false,
  ) => {
    const { timeout, toasts } = this.current;
    const prevToast = selectors.toast(this.current, id);
    if (!prevToast) {
      return;
    }

    // Ignore updates for toasts that are already closing.
    // This prevents races where async updates (e.g. promise success/error)
    // can block a dismissal from completing.
    if (prevToast.transitionStatus === 'ending') {
      return;
    }

    const nextToast: StoredToast<Data> = {
      ...prevToast,
      ...updates,
      ...(markUpdated && {
        updateKey: prevToast.updateKey + 1,
      }),
    };

    this.setToasts(toasts.map((toast) => (toast.id === id ? nextToast : toast)));

    const nextTimeout = nextToast.timeout ?? timeout;
    const prevTimeout = prevToast.timeout ?? timeout;

    const timeoutUpdated = Object.hasOwn(updates, 'timeout');

    const shouldHaveTimer =
      nextToast.transitionStatus !== 'ending' && nextToast.type !== 'loading' && nextTimeout > 0;

    const hasTimer = this.timers.has(id);
    const timeoutChanged = prevTimeout !== nextTimeout;
    const wasLoading = prevToast.type === 'loading';

    if (!shouldHaveTimer && hasTimer) {
      this.clearTimer(id);
      return;
    }

    // Schedule or reschedule timer if needed
    if (
      shouldHaveTimer &&
      (!hasTimer || timeoutChanged || timeoutUpdated || wasLoading || resetTimer)
    ) {
      this.clearTimer(id);

      this.scheduleTimer(id, nextTimeout, () => this.closeToast(id));

      if (selectors.expandedOrOutOfFocus(this.current)) {
        this.pauseTimers();
      }
    }
  };

  closeToast = (toastId?: string) => {
    const closeAll = toastId === undefined;
    const { limit, toasts } = this.current;
    let toastsToClose: StoredToast[];

    if (closeAll) {
      toastsToClose = toasts;
      this.clearTimers();
    } else {
      const toast = selectors.toast(this.current, toastId);
      if (!toast) {
        return;
      }
      toastsToClose = [toast];
      this.clearTimer(toastId);
    }

    const endingToasts = toasts.map((item) =>
      closeAll || item.id === toastId
        ? { ...item, transitionStatus: 'ending' as const, height: 0 }
        : item,
    );
    const newToasts = applyLimited(endingToasts, limit);
    this.setToasts(newToasts, !newToasts.some((toast) => toast.transitionStatus !== 'ending'));

    toastsToClose.forEach((toast) => {
      if (toast.transitionStatus !== 'ending') {
        toast.onClose?.();
      }
    });

    this.handleFocusManagement(toastId);
  };

  promiseToast = <Value, Data extends object>(
    promiseValue: Promise<Value>,
    options: ToastManagerPromiseOptions<Value, Data>,
  ): Promise<Value> => {
    // Create a loading toast (which does not auto-dismiss).
    const loadingOptions = resolvePromiseOptions(options.loading);
    const id = this.addToast({
      ...loadingOptions,
      type: 'loading',
    });

    const handledPromise = promiseValue
      .then((result: Value) => {
        const successOptions = resolvePromiseOptions(options.success, result);
        this.updateToast(id, {
          ...successOptions,
          type: 'success',
          timeout: successOptions.timeout,
        });

        return result;
      })
      .catch((error: unknown) => {
        const errorOptions = resolvePromiseOptions(options.error, error);
        this.updateToast(id, {
          ...errorOptions,
          type: 'error',
          timeout: errorOptions.timeout,
        });

        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- The promise of the consumer gave this reason, and the handler passes it on.
        return Promise.reject(error);
      });

    // Private API used exclusively by `Manager` to handoff the promise
    // back to the manager after it's handled here.
    if (Object.hasOwn(options, 'setPromise')) {
      (options as any).setPromise(handledPromise);
    }

    return handledPromise;
  };

  pauseTimers() {
    if (this.areTimersPaused) {
      return;
    }
    this.areTimersPaused = true;
    this.stopTimers();
  }

  resumeTimers() {
    if (!this.areTimersPaused) {
      return;
    }
    this.areTimersPaused = false;
    if (!this.areTimersSuspended) {
      this.startTimers();
    }
  }

  private stopTimers() {
    this.timers.forEach((timer) => {
      // Timers added while stopped never ran, and stopped timers already
      // recorded their remaining time, so leave both alone.
      if (timer.timeout?.isStarted()) {
        timer.timeout.clear();
        // `start` is stamped on every resume, so subtracting from `remaining`
        // (rather than from the original delay) keeps repeated pause/resume
        // cycles from handing the toast extra time.
        timer.remaining = Math.max(timer.remaining - (Date.now() - timer.start), 0);
      }
    });
  }

  private startTimers() {
    this.timers.forEach((timer, id) => {
      timer.remaining = timer.remaining > 0 ? timer.remaining : timer.delay;
      timer.timeout ??= Timeout.create();
      timer.timeout.start(timer.remaining, () => {
        this.handleTimerFired(id);
        timer.callback();
      });
      timer.start = Date.now();
    });
  }

  restoreFocusToPrevElement() {
    const { prevFocusElement, viewport } = this.current;
    const doc = ownerDocument(prevFocusElement);
    // `body` can't be focused, so return focus to it by blurring whatever has it.
    if (prevFocusElement === doc.body) {
      (activeElement(doc) as HTMLElement | null)?.blur();
    } else {
      prevFocusElement?.focus({ preventScroll: true });
    }
    const restored = !contains(viewport, activeElement(doc));
    // Clear the F6 origin so later visits don't restore stale focus. Keep it if focus couldn't
    // leave: clearing it unmounts the focus guards, and a focused guard would drop focus without
    // a blur, leaving the viewport `focused`.
    if (restored) {
      this.set('prevFocusElement', null);
    }
    return restored;
  }

  handleDocumentPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') {
      return;
    }

    const target = getTarget(event) as Element | null;
    if (contains(this.current.viewport, target)) {
      return;
    }

    // This is explicit touch activity outside the viewport, so the paused
    // interaction state should end even if the window focus state is unchanged.
    this.resumeTimers();
    this.update({ hovering: false, focused: false });
  };

  private scheduleTimer(id: string, delay: number, callback: () => void) {
    const start = Date.now();
    const shouldStartActive =
      !this.areTimersSuspended && !selectors.expandedOrOutOfFocus(this.current);
    const currentTimeout = shouldStartActive ? Timeout.create() : undefined;

    currentTimeout?.start(delay, () => {
      this.handleTimerFired(id);
      callback();
    });

    this.timers.set(id, {
      timeout: currentTimeout,
      start,
      delay,
      remaining: delay,
      callback,
    });
  }

  private clearTimers() {
    this.timers.forEach((timer) => {
      timer.timeout?.clear();
    });
    this.timers.clear();
    this.areTimersPaused = false;
  }

  private clearTimer(id: string) {
    const timer = this.timers.get(id);
    timer?.timeout?.clear();
    this.timers.delete(id);

    this.resetPausedStateIfNoTimersRemain();
  }

  private handleTimerFired(id: string) {
    this.timers.delete(id);
    this.resetPausedStateIfNoTimersRemain();
  }

  private resetPausedStateIfNoTimersRemain() {
    if (this.timers.size === 0) {
      // No timers remain to keep paused; clear the flag so a fresh toast's
      // running timer can be paused again on hover/focus.
      this.areTimersPaused = false;
    }
  }

  private setToasts(newToasts: StoredToast[], clearInteraction: boolean = newToasts.length === 0) {
    const updates = { toasts: newToasts } as Pick<State, 'toasts' | 'hovering' | 'focused'>;

    if (clearInteraction) {
      updates.hovering = false;
      updates.focused = false;
    }

    this.update(updates);
  }

  private handleFocusManagement(toastId: string | undefined) {
    const { viewport } = this.current;
    // With no viewport, no toast has the focus. A server has no viewport and no document.
    if (!viewport) {
      return;
    }

    const activeEl = activeElement(ownerDocument(viewport));
    if (!contains(viewport, activeEl) || !isFocusVisible(activeEl)) {
      return;
    }

    if (toastId === undefined) {
      this.restoreFocusToPrevElement();
      return;
    }

    const toasts = selectors.toasts(this.current);
    const currentIndex = selectors.toastIndex(this.current, toastId);

    // A toast that was `limited` stays `inert` until Vue updates the DOM, so it can't take focus yet.
    const scan = (from: number, step: number) => {
      for (let index = from; index >= 0 && index < toasts.length; index += step) {
        /* eslint-disable @typescript-eslint/no-non-null-assertion -- The loop condition proves the index. */
        const element = toasts[index]!.ref?.value;
        if (toasts[index]!.transitionStatus !== 'ending' && element && !element.inert) {
          return element;
        }
        /* eslint-enable @typescript-eslint/no-non-null-assertion */
      }
      return null;
    };

    // Try to find the next toast that can hold focus, then fall back to the previous one.
    const nextElement = scan(currentIndex + 1, 1) ?? scan(currentIndex - 1, -1);

    if (nextElement) {
      nextElement.focus();
    } else {
      this.restoreFocusToPrevElement();
    }
  }
}

interface TimerInfo {
  timeout?: Timeout | undefined;
  /** Timestamp of the last time the timeout started running. */
  start: number;
  /** Full timeout duration, used to restart a timer that elapsed while throttled. */
  delay: number;
  /** Time left before the toast auto-dismisses, excluding any paused time. */
  remaining: number;
  callback: () => void;
}
