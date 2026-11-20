<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectComboboxRoot, injectPortal } from './root';
import type { ComboboxBackdropProps, ComboboxBackdropState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ComboboxBackdropProps>();
defineSlots<{
  default?(scope: { state: ComboboxBackdropState }): unknown;
  element?(scope: ElementSlotProps<ComboboxBackdropState>): unknown;
}>();

const context = injectComboboxRoot('Backdrop');
injectPortal(context, 'Backdrop');
const { root } = context;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const shown = computed(() => (root.open && !root.leaving) || root.keepMounted);
const state = computed<ComboboxBackdropState>(() => ({ open: root.open }));
const removeLeaving = root.addLeaving(() => element.value);
onUnmounted(removeLeaving);

function elementProps() {
  const closed = !root.open;
  return mergeProps(
    {
      role: 'presentation',
      hidden: closed ? true : undefined,
      inert: closed ? true : undefined,
      style: {
        // A double click selects text of the page in Firefox and WebKit
        // (test/measurements/popup.test.ts).
        'user-select': 'none',
        '-webkit-user-select': 'none',
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
