<script setup lang="ts">
import { computed, onUnmounted, useAttrs, useSlots } from 'vue';
import { useButton } from '../common/button';
import { useElement } from '../common/element';
import { injectPopoverRoot } from './root';
import type { PopoverCloseProps, PopoverCloseState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverCloseProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: PopoverCloseState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: PopoverCloseState;
  }): unknown;
}>();

const context = injectPopoverRoot('Close');
const attrs = useAttrs();
const slots = useSlots();
const { element, setElement } = useElement<HTMLElement>();
const button = useButton({
  element,
  disabled: () => props.disabled,
  type: 'button',
  // A tag in `as` is known at the render. The element of the `element` slot is known after the mount.
  tag: () => (!slots.element && typeof props.as === 'string' ? props.as : undefined),
});
const state = computed<PopoverCloseState>(() => ({ disabled: button.disabled.value }));

// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the part
// registers before the call.
const unregister = context.addClose();
onUnmounted(unregister);

function elementProps() {
  return button.mergeAttributes(
    {
      onClick: (event: MouseEvent) => context.root.request(false, 'close-press', event),
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
