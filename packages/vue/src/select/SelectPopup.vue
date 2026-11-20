<script setup lang="ts">
import {
  computed,
  mergeProps,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  shallowRef,
  useAttrs,
  useId,
  watch,
} from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { styleDisableScrollbar, useStyleDisableScrollbar } from '../utils/styles';
import { scrollEdges } from './alignment';
import { injectSelectPositioner, injectSelectRoot } from './root';
import type { SelectPopupProps, SelectPopupState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectPopupProps>(), { finalFocus: undefined });
defineSlots<{
  default?(scope: { state: SelectPopupState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: SelectPopupState;
  }): unknown;
}>();

const context = injectSelectRoot('Popup');
const positioner = injectSelectPositioner('Popup');
const { root, list, typeahead } = context;
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();

// An element that mounts while the root is open shows one update after its mount, so a
// `<Transition>` around the part runs its enter with no `appear` (test/measurements/select.test.ts).
const mounted = shallowRef(false);
onMounted(() => (mounted.value = true));
const shown = computed(() => root.open && mounted.value);
watch(shown, (isShown) => (context.popupShown.value = isShown), { flush: 'sync', immediate: true });

const state = computed<SelectPopupState>(() => ({
  open: root.open,
  side: positioner.side.value,
  align: positioner.align.value,
}));

const elementId = computed(() => givenId(props.id) ?? generatedId);
watch(element, (popup) => root.setPopup(popup), { flush: 'sync', immediate: true });
watch(
  [element, elementId],
  ([popup, current], _, onCleanup) => {
    if (!popup) return;
    context.popupId.value = current;
    onCleanup(() => {
      if (context.popupId.value === current) context.popupId.value = undefined;
    });
  },
  { flush: 'sync', immediate: true },
);
watch(
  () => props.finalFocus,
  (target) => (context.finalFocus.value = target),
  { immediate: true },
);
// Vue stops the watcher before it removes the element of the part, so the part clears the popup of
// the root. The popup of a part that mounted first stays.
onBeforeUnmount(() => {
  if (root.popup === element.value) root.setPopup(null);
});
onUnmounted(() => (context.popupShown.value = false));

// The scroll arrows of a list that scrolls, at each open.
watch(
  () => (shown.value && context.placed.value ? context.container() : null),
  (scroller) => {
    if (scroller) context.scrollable.value = scrollEdges(scroller);
  },
  { flush: 'post' },
);

const ownsList = computed(() => !context.listElement.value);
const hidesScrollbar = computed(
  () =>
    ownsList.value &&
    ((context.arrows.value > 0 && root.interaction !== 'touch') || context.aligned.value),
);
useStyleDisableScrollbar(() => (hidesScrollbar.value ? element.value : null));

function onKeydown(event: KeyboardEvent) {
  if (!list.onKeydown(event)) typeahead.onKeydown(event);
}

function elementProps() {
  const aligned = context.aligned.value;
  const listProps = ownsList.value
    ? {
        role: 'listbox',
        'aria-multiselectable': context.multiple ? 'true' : undefined,
        'aria-readonly': context.readonly ? 'true' : undefined,
        onScroll: (event: Event) => positioner.onScroll(event.currentTarget as HTMLElement),
      }
    : { role: 'presentation' };
  return mergeProps(
    {
      id: elementId.value,
      tabindex: -1,
      ...listProps,
      'data-side': state.value.side,
      'data-align': state.value.align,
      inert: root.open ? undefined : true,
      class: hidesScrollbar.value ? styleDisableScrollbar.className : undefined,
      // The popup fills the positioner that covers the trigger, and its list scrolls.
      style: aligned
        ? {
            height: '100%',
            ...(ownsList.value && {
              position: 'relative',
              maxHeight: '100%',
              overflowX: 'hidden',
              overflowY: 'auto',
            }),
          }
        : undefined,
    },
    attrs,
    // A key listener of the developer that prevents the default stops the keys of the list.
    { onKeydown },
  );
}

defineExpose({ element });
</script>

<!-- The part hides its own element with `v-show`, so a `<Transition>` around the part runs the
enter and the leave of a popup that stays in the DOM. In the `element` slot, `props` has `hidden`
and `inert` while closed. -->
<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="{ ...elementProps(), hidden: shown ? undefined : true }"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-show="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else v-show="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
