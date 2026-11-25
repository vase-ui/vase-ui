<script setup lang="ts">
import { computed, mergeProps, onBeforeUnmount, useAttrs, useId, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { usePopupPart } from '../popup/portal';
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

const { entered, shown } = usePopupPart(root, element);
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

function elementProps() {
  const closed = !root.open;
  return mergeProps(
    {
      ...(isDialog.value ? { role: 'dialog', tabindex: -1 } : { role: 'presentation' }),
      id: givenId(props.id) ?? generatedId,
      'data-side': state.value.side,
      'data-align': state.value.align,
      'data-anchor-hidden': state.value.anchorHidden ? '' : undefined,
      'data-empty': state.value.empty ? '' : undefined,
      // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
      hidden: closed && root.keepMounted ? true : undefined,
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

<!-- The `element` slot renders a fragment, which takes no `v-show`. -->
<template>
  <template v-if="$slots.element">
    <slot
      v-if="root.open || root.keepMounted"
      name="element"
      :props="elementProps()"
      :elementRef="setElement"
      :state="state"
    />
  </template>
  <component :is="as" v-else-if="as" v-show="shown" v-bind="elementProps()" :ref="setElement">
    <slot v-if="entered" :state="state" />
  </component>
  <div v-else v-show="shown" v-bind="elementProps()" :ref="setElement">
    <slot v-if="entered" :state="state" />
  </div>
</template>
