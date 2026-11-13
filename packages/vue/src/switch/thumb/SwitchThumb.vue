<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { SwitchRootState } from '../root/SwitchRoot.vue';

export interface SwitchThumbState extends SwitchRootState {}

export interface SwitchThumbProps
  extends
    VaseUIComponentProps<SwitchThumbState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useSwitchRootContext } from '../root/SwitchRootContext';
import { stateAttributesMapping } from '../stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SwitchThumbProps>(), { as: 'span' });

defineSlots<{
  default(props: { state: SwitchThumbState }): unknown;
  render: ComponentRenderFn<HTMLProps, SwitchThumbState>;
}>();

const state = useSwitchRootContext();

const { element, elementProps } = useRenderElement('span', props, {
  state,
  stateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
