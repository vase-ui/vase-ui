<script setup lang="ts">
import { computed, mergeProps, onMounted, onUnmounted, shallowRef, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectPortal, injectSelectRoot } from './root';
import type { SelectBackdropProps, SelectBackdropState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<SelectBackdropProps>();
defineSlots<{
  default?(scope: { state: SelectBackdropState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: SelectBackdropState;
  }): unknown;
}>();

const { root } = injectSelectRoot('Backdrop');
injectPortal('Backdrop');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const removeLeaving = root.addLeaving(() => element.value);
onUnmounted(removeLeaving);

// As `Select.Popup`: the element shows one update after an open mount.
const mounted = shallowRef(false);
onMounted(() => (mounted.value = true));
const shown = computed(() => root.open && mounted.value);
const state = computed<SelectBackdropState>(() => ({ open: root.open }));

function elementProps() {
  return mergeProps(
    {
      role: 'presentation',
      inert: root.open ? undefined : true,
      // A double click selects text of the page in Firefox and WebKit
      // (test/measurements/popup.test.ts).
      style: { 'user-select': 'none', '-webkit-user-select': 'none' },
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
