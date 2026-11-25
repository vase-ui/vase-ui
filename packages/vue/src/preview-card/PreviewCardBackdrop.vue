<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { usePopupPart } from '../popup/portal';
import { injectPortal, injectPreviewCardRoot } from './root';
import type { PreviewCardBackdropProps, PreviewCardBackdropState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<PreviewCardBackdropProps>();
defineSlots<{
  default?(scope: { state: PreviewCardBackdropState }): unknown;
  element?(scope: ElementSlotProps<PreviewCardBackdropState>): unknown;
}>();

const { root } = injectPreviewCardRoot('Backdrop');
injectPortal('Backdrop');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const { entered, shown } = usePopupPart(root, element);
const state = computed<PreviewCardBackdropState>(() => ({ open: root.open }));

function elementProps() {
  const closed = !root.open;
  return mergeProps(
    {
      role: 'presentation',
      hidden: closed && root.keepMounted ? true : undefined,
      inert: closed ? true : undefined,
      // The page stays in use under a preview card.
      style: { pointerEvents: 'none' },
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<!-- A fragment takes no `v-show`, so the `element` slot renders only while the popup is open. -->
<template>
  <template v-if="$slots.element">
    <slot
      v-if="root.open || root.keepMounted"
      name="element"
      :props="elementProps()"
      :elementRef="setElement"
      :state="state"
    />
  </template>
  <component :is="as" v-else-if="as" v-show="shown" v-bind="elementProps()" :ref="setElement">
    <slot v-if="entered" :state="state" />
  </component>
  <div v-else v-show="shown" v-bind="elementProps()" :ref="setElement">
    <slot v-if="entered" :state="state" />
  </div>
</template>
