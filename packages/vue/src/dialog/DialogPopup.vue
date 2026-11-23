<script setup lang="ts">
import { computed, mergeProps, onBeforeUnmount, useAttrs, useId, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { usePopupPart } from '../popup/portal';
import { injectDialog, injectDialogPortal } from './root';
import type { DialogPopupProps, DialogPopupState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogPopupProps>(), {
  initialFocus: undefined,
  finalFocus: undefined,
});
defineSlots<{
  default?(scope: { state: DialogPopupState }): unknown;
  element?(scope: ElementSlotProps<DialogPopupState>): unknown;
}>();

const context = injectDialog('Popup');
injectDialogPortal('Popup', context);
const { root } = context;
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();

const shown = usePopupPart(root, element);
const state = computed<DialogPopupState>(() => ({
  open: root.open,
  nested: context.nested,
  nestedDialogOpen: context.dialogsAbove > 0,
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
      role: context.role,
      tabindex: -1,
      'aria-labelledby': root.titleId,
      'aria-describedby': root.descriptionId,
      'aria-modal': context.modal === true ? 'true' : undefined,
      'data-nested': context.nested ? '' : undefined,
      'data-nested-dialog-open': state.value.nestedDialogOpen ? '' : undefined,
      // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
      hidden: closed && root.keepMounted ? true : undefined,
      inert: closed ? true : undefined,
      style: { '--nested-dialogs': context.dialogsAbove },
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
    <slot :state="state" />
  </component>
  <div v-else v-show="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
