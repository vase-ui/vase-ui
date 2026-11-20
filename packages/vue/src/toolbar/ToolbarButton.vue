<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { useButton } from '../button/button';
import { useElement } from '../common/element';
import { injectToolbar, useToolbarItem } from './item';
import type { ToolbarButtonProps, ToolbarButtonState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToolbarButtonProps>(), {
  disabled: false,
  focusableWhenDisabled: true,
});
const slots = defineSlots<{
  default?(scope: { state: ToolbarButtonState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ToolbarButtonState;
  }): unknown;
}>();

const toolbar = injectToolbar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const { disabled, mergeAttributes } = useButton({
  element,
  disabled: () => toolbar.disabled || props.disabled,
  focusableWhenDisabled: () => props.focusableWhenDisabled,
  type: 'button',
  tag: () => (!slots.element && typeof props.as === 'string' ? props.as : undefined),
});
const tabindex = useToolbarItem(toolbar, element, {
  disabled: () => disabled.value,
  focusable: () => !disabled.value || props.focusableWhenDisabled,
});
const state = computed<ToolbarButtonState>(() => ({
  disabled: disabled.value,
  focusable: props.focusableWhenDisabled,
  orientation: toolbar.orientation,
}));

defineExpose({ element });

function elementProps() {
  const own: Record<string, unknown> = { 'data-orientation': toolbar.orientation };
  if (tabindex.value !== undefined) own.tabindex = tabindex.value;
  return mergeAttributes(own, attrs);
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
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
