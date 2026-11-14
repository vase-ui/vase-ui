<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ComboboxRowState {}

export interface ComboboxRowProps
  extends
    VaseUIComponentProps<ComboboxRowState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { provide } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { ComboboxRowContext } from './ComboboxRowContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxRowProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ComboboxRowState }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxRowState>;
}>();

provide(ComboboxRowContext, true);

const state: ComboboxRowState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ role: 'row' }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
