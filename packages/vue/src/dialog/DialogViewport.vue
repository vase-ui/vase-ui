<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { keepFocus } from '../popup/portal';
import { injectDialog, injectDialogPortal } from './root';
import type { DialogViewportProps, DialogViewportState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<DialogViewportProps>();
defineSlots<{
  default?(scope: { state: DialogViewportState }): unknown;
  element?(scope: ElementSlotProps<DialogViewportState>): unknown;
}>();

const context = injectDialog('Viewport');
injectDialogPortal('Viewport', context);
const { root } = context;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const state = computed<DialogViewportState>(() => ({
  open: root.open,
  nested: context.nested,
  nestedDialogOpen: context.dialogsAbove > 0,
}));

// The viewport is in the layer of its dialog, so a modal dialog does not hide it from itself.
const removePortalElement = root.addPortalElement(() => element.value);
onUnmounted(removePortalElement);

function elementProps() {
  const closed = !root.open;
  return mergeProps(
    {
      role: 'presentation',
      // While the popup leaves, a press reaches the page and Tab does not reach the popup.
      inert: closed ? true : undefined,
      hidden: closed && root.keepMounted ? true : undefined,
      'data-nested': context.nested ? '' : undefined,
      'data-nested-dialog-open': state.value.nestedDialogOpen ? '' : undefined,
      onMousedown: keepFocus,
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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
