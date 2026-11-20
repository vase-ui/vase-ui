<script setup lang="ts">
import {
  computed,
  mergeProps,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  shallowRef,
  useAttrs,
} from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { isComposing } from '../popup/layer';
import { injectToastProvider } from './provider';
import { provideToastRoot, type ToastRootForParts } from './root';
import { useToastSwipe } from './swipe';
import type { SwipeDirection, ToastRootProps, ToastRootState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastRootProps>(), {
  swipeDirection: () => ['down', 'right'],
});
defineSlots<{
  default?(scope: { state: ToastRootState }): unknown;
  element?(scope: ElementSlotProps<ToastRootState>): unknown;
}>();

const provider = injectToastProvider('<Toast.Root>');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const isOpen = () => provider.toasts.some((toast) => toast.id === props.toast.id);
const place = computed(() => provider.place(props.toast.id));
const swipe = useToastSwipe({
  directions: (): SwipeDirection[] =>
    props.toast.positionerProps?.anchor === undefined ? [props.swipeDirection].flat() : [],
  close: () => provider.close(props.toast.id),
});

type Label = {
  kind: 'title' | 'description';
  label: { readonly id: string; readonly shown: boolean };
};
const labels = shallowRef<Label[]>([]);
const lastLabel = (kind: Label['kind']) =>
  labels.value.findLast((entry) => entry.kind === kind && entry.label.shown)?.label.id;

function measure() {
  const root = element.value;
  if (!root || !isOpen()) return;
  // The natural height, also for a toast that a style gives the height of the front toast.
  const height = root.style.height;
  root.style.height = 'auto';
  const natural = root.offsetHeight;
  root.style.height = height;
  provider.setHeight(props.toast.id, natural);
}
onMounted(measure);

const context: ToastRootForParts = {
  get toast() {
    return props.toast;
  },
  get expanded() {
    return provider.expanded;
  },
  get behind() {
    return place.value.index > 0;
  },
  addLabel(kind, label) {
    const entry = { kind, label };
    labels.value = [...labels.value, entry];
    return () => (labels.value = labels.value.filter((each) => each !== entry));
  },
  measure,
};
provideToastRoot(context);

// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the part
// registers before the call.
const removeRoot = provider.addRoot({
  get id() {
    return props.toast.id;
  },
  get element() {
    return element.value;
  },
});
// Vue clears the ref before `onUnmounted`.
let unmountedElement: HTMLElement | null = null;
onBeforeUnmount(() => (unmountedElement = element.value));
onUnmounted(() => {
  removeRoot();
  const root = unmountedElement;
  const { toast } = props;
  if (!root || isOpen()) return;
  // In a `<TransitionGroup>`, Vue keeps the element for its leave. The element with the classes
  // can be a positioner or an element of the developer around the root.
  const endLeave = provider.addLeaving();
  const removed = () => {
    endLeave();
    if (!provider.toasts.some((each) => each.id === toast.id)) toast.onRemove?.();
  };
  if (!root.isConnected) {
    removed();
    return;
  }
  const observer = new MutationObserver(() => {
    if (root.isConnected) return;
    observer.disconnect();
    removed();
  });
  observer.observe(root.ownerDocument, { childList: true, subtree: true });
});

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented || isComposing(event) || !isOpen()) return;
  provider.close(props.toast.id);
  // A popup under the toast, such as a modal dialog, stays open (VUE-127).
  event.preventDefault();
  event.stopPropagation();
}

const state = computed<ToastRootState>(() => ({
  expanded: provider.expanded,
  limited: !!props.toast.limited,
  type: props.toast.type,
  swiping: swipe.swiping.value,
  swipeDirection: swipe.direction.value,
}));

const isText = (value: unknown) => typeof value === 'string' && value.trim() !== '';

function elementProps() {
  const high = props.toast.priority === 'high';
  const titleId = lastLabel('title');
  const descriptionId = lastLabel('description');
  // WAI-ARIA requires a name for a `dialog` and an `alertdialog`. A toast with no title and no name
  // of the developer takes the name of its description (VUE-99).
  const named = isText(attrs['aria-label']) || isText(attrs['aria-labelledby']);
  const byDescription = !titleId && !named;
  const { height } = props.toast;
  return mergeProps(
    {
      role: high ? 'alertdialog' : 'dialog',
      tabindex: 0,
      'aria-modal': 'false',
      'aria-labelledby': byDescription ? descriptionId : titleId,
      'aria-describedby': byDescription ? undefined : descriptionId,
      'aria-hidden': high && !provider.focused ? 'true' : undefined,
      inert: props.toast.limited ? '' : undefined,
      'data-expanded': state.value.expanded ? '' : undefined,
      'data-type': state.value.type,
      'data-swiping': state.value.swiping ? '' : undefined,
      'data-swipe-direction': state.value.swipeDirection,
      style: [
        {
          '--toast-index': place.value.index,
          '--toast-offset-y': `${place.value.offsetY}px`,
          '--toast-height': height ? `${height}px` : undefined,
        },
        swipe.style.value,
      ],
      onKeydown,
      ...swipe.listeners.value,
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
