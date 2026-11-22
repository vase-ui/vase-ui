<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useButton } from '../common/button';
import { useAsTag, useElement, type ElementSlotProps } from '../common/element';
import { useEnterAfterLeave } from '../common/useEnterAfterLeave';
import { hasContent, useHasSlot } from './label';
import { injectToastRoot } from './root';
import type { ToastActionProps, ToastActionState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastActionProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: ToastActionState }): unknown;
  element?(scope: ElementSlotProps<ToastActionState>): unknown;
}>();

const root = injectToastRoot('Action');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const button = useButton({
  element,
  disabled: () => props.disabled,
  type: 'button',
  tag: useAsTag(() => props.as),
});
const hasSlot = useHasSlot();
// The content of the toast wins over the slot.
const content = computed(() => root.toast.actionProps?.children);
const needed = computed(() =>
  content.value === undefined ? hasSlot.value : hasContent(content.value),
);
const { waiting } = useEnterAfterLeave(() => needed.value, element);
const shown = computed(() => needed.value && !waiting.value);

const state = computed<ToastActionState>(() => ({ type: root.toast.type }));

function elementProps() {
  const { children: _children, ...actionAttrs } = root.toast.actionProps ?? {};
  // The attributes of the toast win, because they are of one toast.
  return button.mergeAttributes(
    { 'data-type': state.value.type, ...(root.ariaHidden ? { tabindex: -1 } : {}) },
    mergeProps(attrs, actionAttrs as Record<string, unknown>),
  );
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="shown && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="shown && as" v-bind="elementProps()" :ref="setElement">
    <component :is="content" v-if="typeof content === 'function'" />
    <template v-else-if="content !== undefined">{{ content }}</template>
    <slot v-else :state="state" />
  </component>
  <button v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <component :is="content" v-if="typeof content === 'function'" />
    <template v-else-if="content !== undefined">{{ content }}</template>
    <slot v-else :state="state" />
  </button>
</template>
