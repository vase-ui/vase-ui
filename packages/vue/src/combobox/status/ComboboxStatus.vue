<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ComboboxStatusState {}

export interface ComboboxStatusProps
  extends
    VaseUIComponentProps<ComboboxStatusState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../common/empty';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useInitialLiveRegionTextMutation } from '../../internals/useInitialLiveRegionTextMutation';
import { useRenderElement } from '../../internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxStatusProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ComboboxStatusState }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxStatusState>;
}>();

const statusRef = useInitialLiveRegionTextMutation<HTMLElement>();

const state: ComboboxStatusState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: statusRef,
  props: (attrs) => [{ role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
