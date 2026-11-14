<script lang="ts">
import type { ToastManager } from '../createToastManager';

export interface ToastProviderState {}

export interface ToastProviderProps {
  /**
   * The default amount of time (in ms) before a toast is auto dismissed.
   * A value of `0` will prevent the toast from being dismissed automatically.
   * @default 5000
   */
  timeout?: number | undefined;
  /**
   * The maximum number of toasts that can be displayed at once.
   * When the limit is exceeded, the oldest toasts are marked as `limited` (via the `data-limited`
   * attribute) rather than removed, so they can be hidden or animated out.
   * @default 3
   */
  limit?: number | undefined;
  /**
   * A global manager for toasts to use outside of a component.
   */
  toastManager?: ToastManager | undefined;
}
</script>

<script setup lang="ts">
import { onActivated, onDeactivated, onMounted, onScopeDispose, provide, watch } from 'vue';
import type { ToastManagerEvent } from '../createToastManager';
import { ToastStore } from '../store';
import { ToastContext } from './ToastProviderContext';

const props = withDefaults(defineProps<ToastProviderProps>(), { timeout: 5000, limit: 3 });

defineSlots<{
  default?: () => unknown;
}>();

const store = new ToastStore({
  timeout: props.timeout,
  limit: props.limit,
  viewport: null,
  toasts: [],
  hovering: false,
  focused: false,
  isWindowFocused: true,
  prevFocusElement: null,
});

provide(ToastContext, store);

// Suspend the timers of the store. `hold` starts them when the provider is mounted. A server never
// mounts the provider, so a toast that a `setup` adds on a server gets no timer.
store.disposeEffect()();

let releaseTimers: (() => void) | undefined;
let unsubscribe: (() => void) | undefined;
// `KeepAlive` also calls `onActivated` at the first mount, and then there is nothing to take back.
let deactivated = false;

function handleManagerEvent({ action, options }: ToastManagerEvent) {
  const id = options.id;

  if (action === 'promise' && options.promise) {
    store.promiseToast(options.promise, options);
  } else if (action === 'update' && id) {
    store.updateToast(id, options.updates);
  } else if (action === 'close') {
    store.closeToast(id);
  } else {
    store.addToast(options);
  }
}

// The provider listens to its manager only while it holds its timers: after the mount, and not
// while `KeepAlive` holds it. A server never subscribes, so a manager that all requests share gets
// no listener of a request.
function subscribe() {
  unsubscribe?.();
  unsubscribe = undefined;

  if (props.toastManager && releaseTimers) {
    unsubscribe = props.toastManager[' subscribe'](handleManagerEvent);
  }
}

function hold() {
  releaseTimers = store.disposeEffect();
  subscribe();
}

function release() {
  releaseTimers?.();
  releaseTimers = undefined;
  unsubscribe?.();
  unsubscribe = undefined;
}

onMounted(hold);

onDeactivated(() => {
  deactivated = true;
  release();
});

onActivated(() => {
  if (deactivated) {
    deactivated = false;
    hold();
  }
});

onScopeDispose(release);

watch(() => props.toastManager, subscribe);

// The store follows the props before the parts below render. A part that adds a toast in the same
// update then sees the new timeout and limit.
watch(
  () => [props.timeout, props.limit] as const,
  ([timeout, limit]) => {
    store.syncProviderProps(timeout, limit);
  },
);
</script>

<template>
  <slot />
</template>
