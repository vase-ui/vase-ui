<script setup lang="ts">
import { computed, mergeProps, onBeforeUnmount, useAttrs, useId, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { usePopupPart } from '../popup/portal';
import { edgeStyle, sizeVariables } from '../popup/viewport';
import { injectPopoverRoot, injectPositioner } from './root';
import type { PopoverPopupProps, PopoverPopupState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverPopupProps>(), {
  initialFocus: undefined,
  finalFocus: undefined,
});
defineSlots<{
  default?(scope: { state: PopoverPopupState }): unknown;
  element?(scope: ElementSlotProps<PopoverPopupState>): unknown;
}>();

const context = injectPopoverRoot('Popup');
const placement = injectPositioner('Popup');
const { root, layer } = context;
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();

const { entered, shown } = usePopupPart(root, element);
const state = computed<PopoverPopupState>(() => ({
  open: root.open,
  side: placement.side.value,
  align: placement.align.value,
  instant: root.instant,
}));

watch(element, (popup) => root.setPopup(popup), { flush: 'sync' });
// Vue stops the watcher before it removes the element of the part, so the part clears the popup of
// the root. The popup of a part that mounted first stays.
onBeforeUnmount(() => {
  if (root.popup === element.value) root.setPopup(null);
});
watch(
  () => [props.initialFocus, props.finalFocus] as const,
  ([initialFocus, finalFocus]) => (context.popupFocus.value = { initialFocus, finalFocus }),
  { immediate: true },
);

function elementProps() {
  const closed = !root.open;
  return mergeProps(
    {
      id: givenId(props.id) ?? generatedId,
      role: 'dialog',
      tabindex: -1,
      'aria-labelledby': root.titleId,
      'aria-describedby': root.descriptionId,
      'aria-modal': layer.hide === 'inert' && root.open ? 'true' : undefined,
      'data-side': state.value.side,
      'data-align': state.value.align,
      'data-instant': root.instant,
      // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
      hidden: closed && root.keepMounted ? true : undefined,
      inert: closed ? true : undefined,
      style: [
        sizeVariables('popup', context.viewport.value?.popup),
        context.viewport.value?.positioner ? edgeStyle(placement.physicalSide.value) : {},
      ],
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
