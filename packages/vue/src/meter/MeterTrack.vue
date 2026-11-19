<script setup lang="ts">
import { useAttrs, type HTMLAttributes } from 'vue';
import { useElement } from '../common/element';

defineOptions({ inheritAttrs: false });

defineProps</* @vue-ignore */ HTMLAttributes>();
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
  <div v-else v-bind="attrs" :ref="setElement">
    <slot />
  </div>
</template>
