<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ComboboxIconState {}

export interface ComboboxIconProps
  extends
    VaseUIComponentProps<ComboboxIconState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { Component } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import ComboboxIconChildren from './ComboboxIconChildren.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxIconProps>(), { as: 'span' });

defineSlots<{
  /**
   * The content of the icon. The default is `▼`.
   */
  default(props: { state: ComboboxIconState }): unknown;
  render(props: { props: HTMLProps; state: ComboboxIconState; children: Component }): unknown;
}>();

const state: ComboboxIconState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('span', props, {
  state,
  props: (attrs) => [{ 'aria-hidden': true }, attrs],
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="ComboboxIconChildren" />
  <component :is="as" v-else v-bind="elementProps()"><ComboboxIconChildren><template v-if="$slots.default" #default><slot :state="state" /></template></ComboboxIconChildren></component>
</template>
