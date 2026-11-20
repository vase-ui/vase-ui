<script setup lang="ts">
import {
  computed,
  inject,
  mergeProps,
  onBeforeUnmount,
  onUnmounted,
  useAttrs,
  watch,
  type CSSProperties,
} from 'vue';
import { useElement } from '../common/element';
import { sizeVariables, usePopupSizes } from '../popup/viewport';
import { injectNavigationMenuRoot, injectPositioner, sizesKey } from './root';
import type { NavigationMenuPopupProps, NavigationMenuPopupState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<NavigationMenuPopupProps>();
defineSlots<{
  default?(scope: { state: NavigationMenuPopupState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: NavigationMenuPopupState;
  }): unknown;
}>();

const root = injectNavigationMenuRoot('Popup');
const placement = injectPositioner('Popup');
const { popup } = root;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

// While the old popup leaves, a new open waits: a second element would keep its enter classes.
const shown = computed(() => (popup.open && !popup.leaving) || popup.keepMounted);
const state = computed<NavigationMenuPopupState>(() => ({
  open: popup.open,
  side: placement.side.value,
  align: placement.align.value,
  anchorHidden: placement.anchorHidden.value,
}));

watch(element, (current) => popup.setPopup(current), { flush: 'sync' });
// Vue stops the watcher before it removes the element of the part, so the part clears the popup of
// the root. The popup of a part that mounted first stays.
onBeforeUnmount(() => {
  if (popup.popup === element.value) popup.setPopup(null);
});
const removeLeaving = popup.addLeaving(() => element.value);
onUnmounted(removeLeaving);

// The popup takes the size of its new content in steps: at a change of the item, and at a change
// in the shown content, such as a nested menu that changes its item.
const sizes = usePopupSizes(() => (popup.open ? element.value : null));
const slot = inject(sizesKey, null);
if (slot) {
  slot.value = sizes;
  onUnmounted(() => {
    if (slot.value === sizes) slot.value = null;
  });
}
watch(
  () => root.value,
  (next, previous) => {
    if (next != null && previous != null) void sizes.resize();
  },
);
watch(
  () => root.shownContent,
  (content, _, onCleanup) => {
    if (!content) return;
    const observer = new MutationObserver(() => void sizes.resize());
    observer.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
      attributeFilter: ['hidden'],
    });
    onCleanup(() => observer.disconnect());
  },
  { immediate: true },
);

// At the side `top` and at the physical side `left`, the popup is at the edge of the positioner that
// faces the trigger, so it grows away from the trigger while its size changes.
function edgeStyle(side: 'top' | 'bottom' | 'left' | 'right'): CSSProperties {
  if (side === 'top') return { position: 'absolute', bottom: 0 };
  if (side === 'left') return { position: 'absolute', right: 0 };
  return {};
}

function elementProps() {
  const closed = !popup.open;
  return mergeProps(
    {
      tabindex: -1,
      // A name of the developer wins over the name of the trigger.
      'aria-labelledby': attrs['aria-label'] ? undefined : root.triggerIdOf(root.shown),
      'data-side': state.value.side,
      'data-align': state.value.align,
      'data-anchor-hidden': state.value.anchorHidden ? '' : undefined,
      // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
      hidden: closed ? true : undefined,
      inert: closed ? true : undefined,
      style: [sizeVariables('popup', sizes.popup.value), edgeStyle(placement.physicalSide.value)],
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
  <nav v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </nav>
</template>
