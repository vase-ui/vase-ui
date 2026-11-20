<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectPopoverRoot, injectPortal } from './root';
import type { PopoverBackdropProps, PopoverBackdropState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<PopoverBackdropProps>();
defineSlots<{
  default?(scope: { state: PopoverBackdropState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: PopoverBackdropState;
  }): unknown;
}>();

const context = injectPopoverRoot('Backdrop');
injectPortal('Backdrop');
const { root } = context;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const shown = computed(() => (root.open && !root.leaving) || root.keepMounted);
const state = computed<PopoverBackdropState>(() => ({ open: root.open }));
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
        // The page stays in use under a popover that a hover opened.
        pointerEvents: context.hoverOpen ? 'none' : undefined,
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
