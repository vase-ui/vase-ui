<script setup lang="ts">
import { computed, mergeProps, onBeforeUnmount, useAttrs, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { usePopupPart } from '../popup/portal';
import { sizeVariables, usePopupEdge } from '../popup/viewport';
import { injectPositioner, injectPreviewCardRoot } from './root';
import type { PreviewCardPopupProps, PreviewCardPopupState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<PreviewCardPopupProps>();
defineSlots<{
  default?(scope: { state: PreviewCardPopupState }): unknown;
  element?(scope: ElementSlotProps<PreviewCardPopupState>): unknown;
}>();

const context = injectPreviewCardRoot('Popup');
const placement = injectPositioner('Popup');
const { root } = context;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const { entered, shown } = usePopupPart(root, element);
const state = computed<PreviewCardPopupState>(() => ({
  open: root.open,
  side: placement.side.value,
  align: placement.align.value,
  instant: root.instant as PreviewCardPopupState['instant'],
}));

watch(element, (popup) => root.setPopup(popup), { flush: 'sync' });
// Vue stops the watcher before it removes the element of the part, so the part clears the popup of
// the root. The popup of a part that mounted first stays.
onBeforeUnmount(() => {
  if (root.popup === element.value) root.setPopup(null);
});

usePopupEdge(
  () => element.value,
  () => placement.physicalSide.value,
  () => context.viewport.value?.positioner,
);

function elementProps() {
  const closed = !root.open;
  return mergeProps(
    {
      // A press on text in the card moves the focus to the card, and not to `<body>`
      // (test/measurements/preview-card.test.ts).
      tabindex: -1,
      'data-side': state.value.side,
      'data-align': state.value.align,
      'data-instant': root.instant,
      // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
      hidden: closed && root.keepMounted ? true : undefined,
      inert: closed ? true : undefined,
      style: sizeVariables('popup', context.viewport.value?.popup),
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<!-- The `element` slot renders a fragment, which takes no `v-show`. -->
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
