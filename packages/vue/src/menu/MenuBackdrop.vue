<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import { injectMenu, injectPortal } from './root';
import type { MenuBackdropProps, MenuBackdropState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<MenuBackdropProps>();
defineSlots<{
  default?(scope: { state: MenuBackdropState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: MenuBackdropState;
  }): unknown;
}>();

const context = injectMenu('Backdrop');
injectPortal('Backdrop');
const { root } = context;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const shown = computed(() => (root.open && !root.leaving) || root.keepMounted);
const state = computed<MenuBackdropState>(() => ({ open: root.open }));
// Vue does not patch an element that leaves in a `<Transition>`. A press in the leave reaches the
// page, such as a second right press on the trigger of a context menu.
watch(
  () => root.open,
  (open) => {
    if (!open) element.value?.setAttribute('inert', '');
  },
  { flush: 'sync' },
);
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
        // The page stays in use under a menu that a hover opened.
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
