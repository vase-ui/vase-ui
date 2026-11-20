<script setup lang="ts">
import { computed, mergeProps, ref, useAttrs } from 'vue';
import type { ElementSlotProps } from '@vase-ui/vue/types';
import { useElement } from '@vase-ui/vue/use-element';
import styles from './index.module.css';

interface CounterState {
  odd: boolean;
  count: number;
}

defineOptions({ inheritAttrs: false });
defineSlots<{
  default?(scope: { state: CounterState }): unknown;
  element?(scope: ElementSlotProps<CounterState>): unknown;
}>();

const attrs = useAttrs();
const count = ref(0);
const state = computed<CounterState>(() => ({ odd: count.value % 2 === 1, count: count.value }));
const { element, setElement } = useElement();

const elementProps = () =>
  mergeProps(
    {
      class: styles.Button,
      type: 'button',
      'aria-label': `Counter: ${count.value}, click to increase.`,
      onClick() {
        count.value += 1;
      },
    },
    attrs,
  );

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state">
      Counter: <span :class="styles.count">{{ count }}</span>
    </slot>
  </button>
</template>
