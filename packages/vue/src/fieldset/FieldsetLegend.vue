<script setup lang="ts">
import { computed, inject, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { legendKey } from './root';
import type { FieldsetLegendProps } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<FieldsetLegendProps>();
defineSlots<{
  default?(): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
  }): unknown;
}>();

const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLDivElement>();

const root = inject(legendKey, null);
const defaultId = root?.firstLegendId ?? generatedId;
const elementId = computed(() => givenId(props.id) ?? defaultId);

if (root) {
  // Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the
  // part registers before the call.
  const unregister = root.addLegend({
    get id() {
      return elementId.value;
    },
  });
  onUnmounted(unregister);
}

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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot />
  </div>
</template>
