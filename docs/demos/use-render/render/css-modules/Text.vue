<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import type { ElementSlotProps } from '@vase-ui/vue/types';
import { useElement } from '@vase-ui/vue/use-element';
import styles from './index.module.css';

defineOptions({ inheritAttrs: false });
defineSlots<{
  default?(): unknown;
  element?(scope: ElementSlotProps<Record<string, never>>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement();
const elementProps = () => mergeProps({ class: styles.Text }, attrs);

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="{}"
  />
  <p v-else v-bind="elementProps()" :ref="setElement"><slot /></p>
</template>
