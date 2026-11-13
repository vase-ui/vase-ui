<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { ToolbarRootState } from '../root/ToolbarRoot.vue';

export interface ToolbarGroupState extends ToolbarRootState {}

export interface ToolbarGroupProps
  extends
    VaseUIComponentProps<ToolbarGroupState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * When `true` all toolbar items in the group are disabled.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToolbarRootContext } from '../root/ToolbarRootContext';
import { ToolbarGroupContext } from './ToolbarGroupContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToolbarGroupProps>(), { as: 'div', disabled: false });

defineSlots<{
  default(props: { state: ToolbarGroupState }): unknown;
  render: ComponentRenderFn<HTMLProps, ToolbarGroupState>;
}>();

const { orientation, disabled: toolbarDisabled } = useToolbarRootContext();

const groupDisabled = computed(() => toolbarDisabled.value || props.disabled);

provide(ToolbarGroupContext, { disabled: groupDisabled });

const state = computed<ToolbarGroupState>(() => ({
  disabled: groupDisabled.value,
  orientation: orientation.value,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ role: 'group' }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
