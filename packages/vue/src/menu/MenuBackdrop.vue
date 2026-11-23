<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { usePopupPart } from '../popup/portal';
import { injectMenu, injectPortal } from './root';
import type { MenuBackdropProps, MenuBackdropState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<MenuBackdropProps>();
defineSlots<{
  default?(scope: { state: MenuBackdropState }): unknown;
  element?(scope: ElementSlotProps<MenuBackdropState>): unknown;
}>();

const context = injectMenu('Backdrop');
injectPortal('Backdrop');
const { root } = context;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const shown = usePopupPart(root, element);
const state = computed<MenuBackdropState>(() => ({ open: root.open }));

function elementProps() {
  const closed = !root.open;
  return mergeProps(
    {
      role: 'presentation',
      hidden: closed && root.keepMounted ? true : undefined,
      inert: closed ? true : undefined,
      style: {
        // The page stays in use under a menu that a hover opened.
        pointerEvents: context.hoverOpen ? 'none' : undefined,
        // A double click selects text of the page in Firefox and WebKit
        // (test/measurements/popup.test.ts).
        'user-select': 'none',
        '-webkit-user-select': 'none',
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
    <slot :state="state" />
  </component>
  <div v-else v-show="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
