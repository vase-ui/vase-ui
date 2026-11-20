<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectNavigationMenuRoot, injectPortal } from './root';
import type { NavigationMenuBackdropProps, NavigationMenuBackdropState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<NavigationMenuBackdropProps>();
defineSlots<{
  default?(scope: { state: NavigationMenuBackdropState }): unknown;
  element?(scope: ElementSlotProps<NavigationMenuBackdropState>): unknown;
}>();

const { popup: root } = injectNavigationMenuRoot('Backdrop');
injectPortal('Backdrop');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

// While the old backdrop leaves, a new open waits: a second element would keep its enter classes.
const shown = computed(() => (root.open && !root.leaving) || root.keepMounted);
const state = computed<NavigationMenuBackdropState>(() => ({ open: root.open }));
onUnmounted(root.addLeaving(() => element.value));

function elementProps() {
  const closed = !root.open;
  return mergeProps(
    {
      role: 'presentation',
      hidden: closed ? true : undefined,
      inert: closed ? true : undefined,
      style: {
        // The page stays in use under a menu that a hover opened.
        pointerEvents: root.reason === 'trigger-hover' ? 'none' : undefined,
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
