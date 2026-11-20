<script setup lang="ts">
import { computed, shallowRef, useAttrs } from 'vue';
import { useButton } from '../common/button';
import { useAsTag, useElement } from '../common/element';
import { injectToastProvider } from './provider';
import { injectToastRoot } from './root';
import type { ToastCloseProps, ToastCloseState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastCloseProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: ToastCloseState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ToastCloseState;
  }): unknown;
}>();

const provider = injectToastProvider('<Toast.Close>');
const root = injectToastRoot('Close');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const button = useButton({
  element,
  disabled: () => props.disabled,
  type: 'button',
  tag: useAsTag(() => props.as),
});
const focused = shallowRef(false);

const state = computed<ToastCloseState>(() => ({ type: root.toast.type }));

function elementProps() {
  return button.mergeAttributes(
    {
      // A collapsed stack hides the button from a screen reader until it gets the focus.
      'aria-hidden': !root.expanded && !focused.value ? 'true' : undefined,
      'data-type': state.value.type,
      onClick: () => provider.close(root.toast.id),
      onFocus: () => (focused.value = true),
      onBlur: () => (focused.value = false),
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
