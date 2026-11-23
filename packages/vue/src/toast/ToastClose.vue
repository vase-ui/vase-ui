<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { useButton } from '../common/button';
import { useAsTag, useElement, type ElementSlotProps } from '../common/element';
import { injectToastProvider } from './provider';
import { injectToastRoot } from './root';
import type { ToastCloseProps, ToastCloseState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastCloseProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: ToastCloseState }): unknown;
  element?(scope: ElementSlotProps<ToastCloseState>): unknown;
}>();

const provider = injectToastProvider('<Toast.Close>');
const root = injectToastRoot('Close');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const button = useButton({
  element,
  disabled: () => props.disabled,
  type: 'button',
  tag: useAsTag(() => props.as, 'button'),
});

const state = computed<ToastCloseState>(() => ({ type: root.toast.type }));

function elementProps() {
  // A collapsed stack hides the button from a screen reader until the focus comes into its toast.
  const ariaHidden = !root.expanded && !root.focusWithin;
  return button.mergeAttributes(
    {
      'aria-hidden': ariaHidden ? 'true' : undefined,
      ...(ariaHidden || root.ariaHidden ? { tabindex: -1 } : {}),
      'data-type': state.value.type,
      onClick: () => provider.close(root.toast.id),
    },
    attrs,
  );
}

defineExpose({ element });
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
