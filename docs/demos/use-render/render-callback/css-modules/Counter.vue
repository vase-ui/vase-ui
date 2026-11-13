<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Component } from 'vue';
import { mergeProps } from '@vase-ui/vue/merge-props';
import { useRender } from '@vase-ui/vue/use-render';
import type { UseRenderRenderProp } from '@vase-ui/vue/use-render';
import styles from './index.module.css';

interface CounterState {
  odd: boolean;
  count: number;
}

defineOptions({ inheritAttrs: false });

const props = defineProps<{ as?: string | Component | undefined }>();

defineSlots<{
  default(props: { state: CounterState }): unknown;
  render: UseRenderRenderProp<CounterState>;
}>();

const count = ref(0);
const state = computed<CounterState>(() => ({ odd: count.value % 2 === 1, count: count.value }));

const { element, elementProps, tag } = useRender(props, {
  defaultTagName: 'button',
  state,
  stateAttributesMapping: { count: () => null },
  props: (attrs) =>
    mergeProps<'button'>(
      {
        class: styles.Button,
        type: 'button',
        onClick() {
          count.value += 1;
        },
        'aria-label': `Counter: ${count.value}, click to increase.`,
      },
      attrs,
    ),
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="tag" v-else v-bind="elementProps()">
    <slot :state="state">
      Counter: <span :class="styles.count">{{ count }}</span>
    </slot>
  </component>
</template>
