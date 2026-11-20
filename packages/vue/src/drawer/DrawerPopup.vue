<script setup lang="ts">
import {
  computed,
  inject,
  mergeProps,
  onBeforeUnmount,
  onUnmounted,
  useAttrs,
  useId,
  watch,
} from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { injectDialogPortal } from '../dialog/root';
import { injectDrawer, viewportKey } from './root';
import type { DrawerPopupProps, DrawerPopupState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DrawerPopupProps>(), {
  initialFocus: undefined,
  finalFocus: undefined,
});
defineSlots<{
  default?(scope: { state: DrawerPopupState }): unknown;
  element?(scope: ElementSlotProps<DrawerPopupState>): unknown;
}>();

const drawer = injectDrawer('Popup');
const { dialog } = drawer;
injectDialogPortal('Popup', dialog, 'Drawer');
if (!inject(viewportKey, false)) {
  throw new Error(
    'Vase UI: <Drawer.Popup> must be inside <Drawer.Viewport>. The viewport holds the swipe of the drawer. Put the popup inside <Drawer.Viewport>.',
  );
}
const { root } = dialog;
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();

// While the old popup leaves, a new open waits: a second element would keep its enter classes.
const shown = computed(() => (root.open && !root.leaving) || root.keepMounted);
const state = computed<DrawerPopupState>(() => ({
  open: root.open,
  expanded: drawer.snap.active === 1,
  nested: dialog.nested,
  nestedDrawerOpen: drawer.nestedOpen > 0,
  nestedDrawerSwiping: drawer.nestedSwiping,
  swipeDirection: drawer.swipeDirection,
  swiping: drawer.swiping,
}));

watch(element, (popup) => root.setPopup(popup), { flush: 'sync' });
// Vue stops the watcher before it removes the element of the part, so the part clears the popup of
// the root. The popup of a part that mounted first stays.
onBeforeUnmount(() => {
  if (root.popup === element.value) root.setPopup(null);
});
watch(
  () => [props.initialFocus, props.finalFocus] as const,
  ([initialFocus, finalFocus]) =>
    // A text field that gets the focus opens the software keyboard, so the popup takes it.
    (dialog.popupFocus.value = { initialFocus: initialFocus ?? (() => element.value), finalFocus }),
  { immediate: true },
);
watch(element, (popup, _, onCleanup) => {
  if (!popup) return;
  const observer = new ResizeObserver(() => drawer.setSizes({ popup: popup.offsetHeight }));
  observer.observe(popup);
  onCleanup(() => observer.disconnect());
});
const removeLeaving = root.addLeaving(() => element.value);
onUnmounted(removeLeaving);

function elementProps() {
  const closed = !root.open;
  const { sample, snap } = drawer;
  const offset = snap.offset ?? 0;
  return mergeProps(
    {
      id: givenId(props.id) ?? generatedId,
      role: dialog.role,
      tabindex: -1,
      'aria-labelledby': root.titleId,
      'aria-describedby': root.descriptionId,
      'aria-modal': dialog.modal === true ? 'true' : undefined,
      'data-expanded': state.value.expanded ? '' : undefined,
      'data-nested-drawer-open': state.value.nestedDrawerOpen ? '' : undefined,
      'data-nested-drawer-swiping': state.value.nestedDrawerSwiping ? '' : undefined,
      'data-swipe-direction': drawer.swipeDirection,
      'data-swiping': drawer.swiping ? '' : undefined,
      // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
      hidden: closed ? true : undefined,
      inert: closed ? true : undefined,
      style: {
        // The popup follows the pointer with no delay of its own transition.
        transition: drawer.swiping ? 'none' : undefined,
        '--nested-drawers': drawer.nestedOpen,
        '--drawer-height': drawer.nestedPresent ? `${drawer.height}px` : undefined,
        '--drawer-frontmost-height': drawer.nestedOpen ? `${drawer.frontmostHeight}px` : undefined,
        '--drawer-snap-point-offset': `${drawer.swipeDirection === 'up' ? -offset : offset}px`,
        '--drawer-swipe-movement-x': `${sample.x}px`,
        '--drawer-swipe-movement-y': `${sample.y}px`,
        '--drawer-swipe-strength': 1,
        '--drawer-swipe-progress': drawer.nestedProgress,
      },
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
