<script setup lang="ts">
import { computed, mergeProps, useAttrs, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectDialogPortal } from '../dialog/root';
import { keepFocus, usePopupPart } from '../popup/portal';
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

const { entered, shown } = usePopupPart(root, element);
// While another drawer is under it, the backdrop of a nested drawer would darken the page twice.
const rendered = computed(() => props.forceRender || !dialog.nested);
const state = computed<DrawerBackdropState>(() => ({ open: root.open }));

watch(element, (backdrop, _, onCleanup) => {
  drawer.setBackdrop(backdrop);
  if (backdrop) onCleanup(dialog.addBackdrop());
});

function elementProps() {
  const closed = !root.open;
  const held = drawer.leaving;
  const progress = held ? held.progress : drawer.progress;
  return mergeProps(
    {
      role: 'presentation',
      hidden: closed && root.keepMounted ? true : undefined,
      inert: closed ? true : undefined,
      'data-swiping': drawer.swiping ? '' : undefined,
      style: {
        '--drawer-swipe-progress': progress,
        '--drawer-swipe-strength': held ? held.strength : 1,
        '--drawer-height':
          progress > 0 && drawer.frontmostHeight > 0 ? `${drawer.frontmostHeight}px` : undefined,
      },
      onMousedown: keepFocus,
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<!-- The part hides its own element with `v-show`, and the portal removes it after the leave. The
`element` slot renders while the popup is open: a fragment takes no `<Transition>`. -->
<template>
  <template v-if="$slots.element">
    <slot
      v-if="rendered && (root.open || root.keepMounted)"
      name="element"
      :props="elementProps()"
      :elementRef="setElement"
      :state="state"
    />
  </template>
  <component
    :is="as"
    v-else-if="rendered && as"
    v-show="shown"
    v-bind="elementProps()"
    :ref="setElement"
  >
    <slot v-if="entered" :state="state" />
  </component>
  <div v-else-if="rendered && !as" v-show="shown" v-bind="elementProps()" :ref="setElement">
    <slot v-if="entered" :state="state" />
  </div>
</template>
