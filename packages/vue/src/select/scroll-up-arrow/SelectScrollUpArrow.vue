<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface SelectScrollUpArrowState {}

export interface SelectScrollUpArrowProps
  extends
    VaseUIComponentProps<SelectScrollUpArrowState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether to keep the HTML element in the DOM while the select popup is not scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import type { Component } from 'vue';
import type { HTMLProps } from '../../internals/types';
import SelectScrollArrow from '../scroll-arrow/SelectScrollArrow.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectScrollUpArrowProps>(), {
  as: 'div',
  keepMounted: false,
});

defineSlots<{
  /**
   * The content of the arrow. The default is `▲`.
   */
  default(props: { state: SelectScrollUpArrowState }): unknown;
  render(props: {
    props: HTMLProps;
    state: SelectScrollUpArrowState;
    children: Component;
  }): unknown;
}>();

// As in Base UI, this part renders `SelectScrollArrow` and makes no element of its own.
// The template has one form for `#render`, one for the content and one for no slot. A `v-if` on a
// slot template makes the slots of `SelectScrollArrow` dynamic. Vue then renders
// `SelectScrollArrow` again each time this part renders. It also renders again each part in that
// slot that has slot content.
// `SelectScrollArrow` shows the arrow only when it gets no default slot. The form for no slot
// keeps that behavior.
const arrow = useTemplateRef('arrow');
const element = computed(() => arrow.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <SelectScrollArrow
    v-if="$slots.render"
    ref="arrow"
    v-bind="{ ...$attrs, ...props }"
    direction="up"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </SelectScrollArrow>
  <SelectScrollArrow
    v-else-if="$slots.default"
    ref="arrow"
    v-bind="{ ...$attrs, ...props }"
    direction="up"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </SelectScrollArrow>
  <SelectScrollArrow v-else ref="arrow" v-bind="{ ...$attrs, ...props }" direction="up" />
</template>
