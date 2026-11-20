<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId, watch } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { injectDialog, injectDialogPortal } from './root';
import type { DialogPopupProps, DialogPopupState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogPopupProps>(), {
  initialFocus: undefined,
  finalFocus: undefined,
});
defineSlots<{
  default?(scope: { state: DialogPopupState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DialogPopupState;
  }): unknown;
}>();

const context = injectDialog('Popup');
injectDialogPortal('Popup', context);
const { root } = context;
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();

// While the old popup leaves, a new open waits: a second element would keep its enter classes.
const shown = computed(() => (root.open && !root.leaving) || root.keepMounted);
const state = computed<DialogPopupState>(() => ({
  open: root.open,
  nested: context.nested,
  nestedDialogOpen: context.dialogsAbove > 0,
}));

watch(element, (popup) => root.setPopup(popup), { flush: 'sync' });
watch(
  () => [props.initialFocus, props.finalFocus] as const,
  ([initialFocus, finalFocus]) => (context.popupFocus.value = { initialFocus, finalFocus }),
  { immediate: true },
);
const removeLeaving = root.addLeaving(() => element.value);
onUnmounted(removeLeaving);

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
      hidden: closed ? true : undefined,
      inert: closed ? true : undefined,
      style: { '--nested-dialogs': context.dialogsAbove },
    },
    attrs,
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
    <slot :state="state" />
  </component>
  <div v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
