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
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import SelectScrollArrow from '../scroll-arrow/SelectScrollArrow.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectScrollUpArrowProps>(), {
  as: 'div',
  keepMounted: false,
});

defineSlots<{
  default(props: { state: SelectScrollUpArrowState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectScrollUpArrowState>;
}>();

// As in Base UI, this part renders `SelectScrollArrow` and makes no element of its own.
const arrow = useTemplateRef('arrow');
const element = computed(() => arrow.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <SelectScrollArrow ref="arrow" v-bind="{ ...$attrs, ...props }" direction="up">
    <template v-if="$slots.render" #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
    <template v-if="$slots.default" #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </SelectScrollArrow>
</template>
