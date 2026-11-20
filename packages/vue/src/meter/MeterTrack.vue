<script setup lang="ts">
import { useAttrs } from 'vue';
import { useElement } from '../common/element';
import type { MeterTrackProps } from './types';

defineOptions({ inheritAttrs: false });

defineProps<MeterTrackProps>();
defineSlots<{
  default?(): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
  }): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLDivElement>();

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.element" name="element" :props="attrs" :elementRef="setElement" />
  <component :is="as" v-else-if="as" v-bind="attrs" :ref="setElement">
    <slot />
  </component>
  <div v-else v-bind="attrs" :ref="setElement">
    <slot />
  </div>
</template>
