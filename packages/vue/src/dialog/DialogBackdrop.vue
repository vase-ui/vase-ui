<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import { keepFocus } from '../popup/portal';
import { injectDialog, injectDialogPortal } from './root';
import type { DialogBackdropProps, DialogBackdropState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogBackdropProps>(), { forceRender: false });
defineSlots<{
  default?(scope: { state: DialogBackdropState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DialogBackdropState;
  }): unknown;
}>();

const context = injectDialog('Backdrop');
injectDialogPortal('Backdrop', context);
const { root } = context;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

// While another dialog is under it, the backdrop of a nested dialog would darken the page twice.
const shown = computed(
  () => ((root.open && !root.leaving) || root.keepMounted) && (props.forceRender || !context.nested),
);
const state = computed<DialogBackdropState>(() => ({ open: root.open }));

const removeLeaving = root.addLeaving(() => element.value);
onUnmounted(removeLeaving);
watch(element, (backdrop, _, onCleanup) => {
  if (backdrop) onCleanup(context.addBackdrop());
});
// A backdrop that leaves in a `<Transition>` takes no press from the page. Vue does not patch an
// element that leaves, so the close writes the attribute.
watch(
  () => root.open,
  (open) => {
    if (!open) element.value?.setAttribute('inert', '');
  },
  { flush: 'sync' },
);

function elementProps() {
  const closed = !root.open;
  return mergeProps(
    {
      role: 'presentation',
      hidden: closed ? true : undefined,
      inert: closed ? true : undefined,
      onMousedown: keepFocus,
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
