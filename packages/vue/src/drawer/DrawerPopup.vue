<script setup lang="ts">
import {
  computed,
  inject,
  mergeProps,
  nextTick,
  onBeforeUnmount,
  useAttrs,
  useId,
  watch,
} from 'vue';
import { createError } from '../common/createError';
import { useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { injectDialogPortal } from '../dialog/root';
import { usePopupPart } from '../popup/portal';
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
  throw createError(27);
}
const { root } = dialog;
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();

const { entered, shown } = usePopupPart(root, element);
const state = computed<DrawerPopupState>(() => ({
  open: root.open,
  expanded: drawer.leaving ? drawer.leaving.expanded : drawer.snap.active === 1,
  nested: dialog.nested,
  nestedDrawerOpen: drawer.nestedOpen > 0,
  nestedDrawerSwiping: drawer.nestedSwiping,
  swipeDirection: drawer.swipeDirection,
  swiping: drawer.swiping,
}));

watch(element, (popup) => root.setPopup(popup), { flush: 'sync' });
// `v-show` removes `display: none` and applies `enter-from` in the post flush after `shown`
// becomes `true`, after a post watcher of `setup`.
const visible = computed(() => root.open && shown.value);
watch(
  visible,
  (isVisible) => {
    if (!isVisible) drawer.setPopupVisible(false);
  },
  { flush: 'sync' },
);
watch(
  visible,
  (isVisible) => {
    if (isVisible) {
      void nextTick(() => {
        if (visible.value) drawer.setPopupVisible(true);
      });
    }
  },
  { immediate: true, flush: 'post' },
);
// Vue stops the watcher before it removes the element of the part, so the part clears the popup of
// the root. The popup of a part that mounted first stays.
onBeforeUnmount(() => {
  if (root.popup === element.value) {
    root.setPopup(null);
    drawer.setPopupVisible(false);
  }
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
// A direct style write keeps a `ResizeObserver` height update from a second slot render at an
// open (`test/measurements/drawer.test.ts`).
watch(
  [element, () => drawer.frontmostHeight] as const,
  ([popup, frontmost]) => {
    if (!popup) return;
    if (frontmost > 0) popup.style.setProperty('--drawer-frontmost-height', `${frontmost}px`);
    else popup.style.removeProperty('--drawer-frontmost-height');
  },
  { flush: 'sync' },
);

function elementProps() {
  const closed = !root.open;
  const held = drawer.leaving;
  const offset = (held ? held.offset : drawer.snap.offset) ?? 0;
  const x = held ? held.x : drawer.sample.x;
  const y = held ? held.y : drawer.sample.y;
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
      hidden: closed && root.keepMounted ? true : undefined,
      inert: closed ? true : undefined,
      style: {
        // The popup follows the pointer with no delay of its own transition.
        transition: drawer.swiping ? 'none' : undefined,
        '--nested-drawers': drawer.nestedOpen,
        '--drawer-height':
          drawer.nestedPresent && drawer.height > 0 ? `${drawer.height}px` : undefined,
        '--drawer-snap-point-offset': `${drawer.swipeDirection === 'up' ? -offset : offset}px`,
        '--drawer-swipe-movement-x': `${x}px`,
        '--drawer-swipe-movement-y': `${y}px`,
        '--drawer-swipe-strength': held ? held.strength : 1,
        '--drawer-swipe-progress': drawer.nestedProgress,
      },
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
