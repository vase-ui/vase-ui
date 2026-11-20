<script setup lang="ts">
import { computed, mergeProps, provide, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectToolbar, toolbarKey } from './item';
import type { ToolbarGroupProps, ToolbarGroupState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToolbarGroupProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: ToolbarGroupState }): unknown;
  element?(scope: ElementSlotProps<ToolbarGroupState>): unknown;
}>();

const toolbar = injectToolbar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<ToolbarGroupState>(() => ({
  disabled: toolbar.disabled || props.disabled,
  orientation: toolbar.orientation,
}));

provide(toolbarKey, {
  get orientation() {
    return toolbar.orientation;
  },
  get disabled() {
    return state.value.disabled;
  },
  get tabStop() {
    return toolbar.tabStop;
  },
  addItem: toolbar.addItem,
});

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      role: 'group',
      'data-disabled': state.value.disabled ? '' : undefined,
      'data-orientation': toolbar.orientation,
    },
    attrs,
  );
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
