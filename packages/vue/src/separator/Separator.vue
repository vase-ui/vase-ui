<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../internals/types';

export interface SeparatorState {
  /**
   * The orientation of the separator.
   */
  orientation: Orientation;
}

export interface SeparatorProps
  extends VaseUIComponentProps<SeparatorState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../internals/types';
import { useRenderElement } from '../internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SeparatorProps>(), {
  as: 'div',
  orientation: 'horizontal',
});

defineSlots<{
  default(props: { state: SeparatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, SeparatorState>;
}>();

const state = computed<SeparatorState>(() => ({ orientation: props.orientation }));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ role: 'separator', 'aria-orientation': props.orientation }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
