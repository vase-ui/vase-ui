<script setup lang="ts">
import {
  computed,
  inject,
  mergeProps,
  nextTick,
  onBeforeUnmount,
  onUnmounted,
  shallowRef,
  useAttrs,
  watch,
  type CSSProperties,
} from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { usePopupPart } from '../popup/portal';
import { sizeVariables, usePopupSizes } from '../popup/viewport';
import { injectNavigationMenuRoot, injectPositioner, sizesKey } from './root';
import type { NavigationMenuPopupProps, NavigationMenuPopupState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<NavigationMenuPopupProps>();
defineSlots<{
  default?(scope: { state: NavigationMenuPopupState }): unknown;
  element?(scope: ElementSlotProps<NavigationMenuPopupState>): unknown;
}>();

const root = injectNavigationMenuRoot('Popup');
const placement = injectPositioner('Popup');
const { popup } = root;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const { entered, shown } = usePopupPart(popup, element);
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

// `v-show` removes `display: none` in the post flush after `entered` becomes `true`, after a post
// watcher of `setup`. In a `disabled` portal, the content teleports into the viewport in the update
// after the mount.
const ready = shallowRef(false);
watch(
  entered,
  (isEntered) => {
    if (isEntered) void nextTick(() => (ready.value = true));
  },
  { immediate: true, flush: 'post' },
);
const sizes = usePopupSizes(() => (popup.open && ready.value ? element.value : null));
const slot = inject(sizesKey, null);
if (slot) {
  slot.value = sizes;
  onUnmounted(() => {
    if (slot.value === sizes) slot.value = null;
  });
}
watch(
  () => root.shown,
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
      hidden: closed && popup.keepMounted ? true : undefined,
      inert: closed ? true : undefined,
      style: [sizeVariables('popup', sizes.popup.value), edgeStyle(placement.physicalSide.value)],
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
      v-if="popup.open || popup.keepMounted"
      name="element"
      :props="elementProps()"
      :elementRef="setElement"
      :state="state"
    />
  </template>
  <component :is="as" v-else-if="as" v-show="shown" v-bind="elementProps()" :ref="setElement">
    <slot v-if="entered" :state="state" />
  </component>
  <nav v-else v-show="shown" v-bind="elementProps()" :ref="setElement">
    <slot v-if="entered" :state="state" />
  </nav>
</template>
