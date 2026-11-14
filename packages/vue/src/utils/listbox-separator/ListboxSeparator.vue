<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ListboxSeparatorState {
  /**
   * The orientation of the separator.
   */
  orientation: Orientation;
}

export interface ListboxSeparatorProps
  extends
    VaseUIComponentProps<ListboxSeparatorState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ListboxSeparatorProps>(), {
  as: 'div',
  orientation: 'horizontal',
});

defineSlots<{
  default(props: { state: ListboxSeparatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, ListboxSeparatorState>;
}>();

const state = computed<ListboxSeparatorState>(() => ({ orientation: props.orientation }));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ role: 'presentation' }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
