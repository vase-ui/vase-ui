<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { injectMeterRoot } from './root';
import type { MeterLabelProps } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<MeterLabelProps>();
defineSlots<{
  default?(): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
  }): unknown;
}>();

const meter = injectMeterRoot('Label');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLSpanElement>();

// The root writes this id in its server HTML before the label renders.
const elementId = computed(() => givenId(props.id) ?? meter.labelId);

// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the
// part registers before the call.
const unregister = meter.addLabel({
  get id() {
    return elementId.value;
  },
});
onUnmounted(unregister);

defineExpose({ element });

function elementProps() {
  return mergeProps({ id: elementId.value }, attrs);
}
</script>

<template>
  <slot v-if="$slots.element" name="element" :props="elementProps()" :elementRef="setElement" />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot />
  </component>
  <span v-else v-bind="elementProps()" :ref="setElement">
    <slot />
  </span>
</template>
