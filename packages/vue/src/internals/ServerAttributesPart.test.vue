<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { ComponentRenderFn, HTMLProps, VaseUIComponentProps, WithVaseUIEvent } from './types';

export interface ServerAttributesPartState {
  active: boolean;
}

export interface ServerAttributesPartProps
  extends
    VaseUIComponentProps<ServerAttributesPartState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  active?: boolean | undefined;
  /** The part gives it as `aria-controls`. With no value, the key has the value `undefined`. */
  controls?: string | undefined;
  /** The part gives it as `abbr`. With no value, the key has the value `undefined`. */
  abbreviation?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useRenderElement } from './useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ServerAttributesPartProps>(), { as: 'div', active: false });

defineSlots<{
  default(props: { state: ServerAttributesPartState }): unknown;
  render: ComponentRenderFn<HTMLProps, ServerAttributesPartState>;
}>();

const state = computed<ServerAttributesPartState>(() => ({ active: props.active }));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    {
      role: 'group',
      'aria-controls': props.controls,
      // The key has no value in each render.
      'aria-hidden': undefined,
      abbr: props.abbreviation,
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
