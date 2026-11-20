<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { useButton } from '../common/button';
import { useAsTag, useElement } from '../common/element';
import { injectDialog } from './root';
import type { DialogCloseProps, DialogCloseState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogCloseProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: DialogCloseState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DialogCloseState;
  }): unknown;
}>();

const context = injectDialog('Close');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const button = useButton({
  element,
  disabled: () => props.disabled,
  type: 'button',
  tag: useAsTag(() => props.as),
});
const state = computed<DialogCloseState>(() => ({ disabled: button.disabled.value }));

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
