<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectDialogPortal } from '../dialog/root';
import { keepFocus } from '../popup/portal';
import { injectDrawer } from './root';
import type { DrawerBackdropProps, DrawerBackdropState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DrawerBackdropProps>(), { forceRender: false });
defineSlots<{
  default?(scope: { state: DrawerBackdropState }): unknown;
  element?(scope: ElementSlotProps<DrawerBackdropState>): unknown;
}>();

const drawer = injectDrawer('Backdrop');
const { dialog } = drawer;
injectDialogPortal('Backdrop', dialog, 'Drawer');
const { root } = dialog;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

// While another drawer is under it, the backdrop of a nested drawer would darken the page twice.
const shown = computed(
  () => ((root.open && !root.leaving) || root.keepMounted) && (props.forceRender || !dialog.nested),
);
const state = computed<DrawerBackdropState>(() => ({ open: root.open }));

const removeLeaving = root.addLeaving(() => element.value);
onUnmounted(removeLeaving);
watch(element, (backdrop, _, onCleanup) => {
  drawer.setBackdrop(backdrop);
  if (backdrop) onCleanup(dialog.addBackdrop());
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
  const { progress } = drawer;
  return mergeProps(
    {
      role: 'presentation',
      hidden: closed ? true : undefined,
      inert: closed ? true : undefined,
      'data-swiping': drawer.swiping ? '' : undefined,
      style: {
        '--drawer-swipe-progress': progress,
        '--drawer-swipe-strength': 1,
        '--drawer-height': progress > 0 ? `${drawer.frontmostHeight}px` : undefined,
      },
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
