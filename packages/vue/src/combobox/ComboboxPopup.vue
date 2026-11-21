<script setup lang="ts">
import { computed, mergeProps, onBeforeUnmount, onUnmounted, useAttrs, useId, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { injectComboboxRoot, injectPositioner, useTriggerIsControl } from './root';
import type { ComboboxPopupProps, ComboboxPopupState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxPopupProps>(), {
  initialFocus: undefined,
  finalFocus: undefined,
});
defineSlots<{
  default?(scope: { state: ComboboxPopupState }): unknown;
  element?(scope: ElementSlotProps<ComboboxPopupState>): unknown;
}>();

const context = injectComboboxRoot('Popup');
const placement = injectPositioner(context, 'Popup');
const { root } = context;
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
// With the trigger as the control, the popup is a dialog, also in a root with no `Input`.
const isDialog = useTriggerIsControl(context);

// While the old popup leaves, a new open waits: a second element would keep its enter classes.
const shown = computed(() => (root.open && !root.leaving) || root.keepMounted);
const state = computed<ComboboxPopupState>(() => ({
  open: root.open,
  side: placement.side.value,
  align: placement.align.value,
  anchorHidden: placement.anchorHidden.value,
  empty: context.empty,
}));

watch(element, (popup) => root.setPopup(popup), { flush: 'sync' });
// Vue stops the watcher before it removes the element of the part, so the part clears the popup of
// the root. The popup of a part that mounted first stays.
onBeforeUnmount(() => {
  if (root.popup === element.value) root.setPopup(null);
});
watch(
  () => [props.initialFocus, props.finalFocus] as const,
  ([initialFocus, finalFocus]) => (context.popupFocus.value = { initialFocus, finalFocus }),
  { immediate: true },
);
const removeLeaving = root.addLeaving(() => element.value);
onUnmounted(removeLeaving);

function elementProps() {
  const closed = !root.open;
  return mergeProps(
    {
      ...(isDialog.value
        ? { role: 'dialog', id: givenId(props.id) ?? generatedId, tabindex: -1 }
        : { role: 'presentation', id: givenId(props.id) }),
      'data-side': state.value.side,
      'data-align': state.value.align,
      'data-anchor-hidden': state.value.anchorHidden ? '' : undefined,
      'data-empty': state.value.empty ? '' : undefined,
      // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
      hidden: closed ? true : undefined,
      inert: closed ? true : undefined,
      // A press on the popup keeps the focus on the input (test/measurements/combobox.test.ts, "a
      // press in a popup while a text input has the focus").
      onMousedown: (event: MouseEvent) => {
        if (event.target === event.currentTarget) event.preventDefault();
      },
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="shown && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="shown && as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
