<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  ComponentRenderFn,
  HTMLProps,
  Orientation,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../src/internals/types';

export interface PlainPartState {
  /** Whether the part is active. */
  active: boolean;
  /** The orientation of the part. */
  orientation: Orientation;
}

export interface PlainPartProps
  extends VaseUIComponentProps<PlainPartState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether the part is active.
   * @default false
   */
  active?: boolean | undefined;
  /**
   * The orientation of the part.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useRenderElement } from '../../src/internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PlainPartProps>(), {
  as: 'div',
  active: false,
  orientation: 'horizontal',
});

defineSlots<{
  default(props: { state: PlainPartState }): unknown;
  render: ComponentRenderFn<HTMLProps, PlainPartState>;
}>();

const state = computed<PlainPartState>(() => ({
  active: props.active,
  orientation: props.orientation,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    {
      class: 'plain-part',
      style: { color: 'red' },
      'aria-orientation': props.orientation,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
