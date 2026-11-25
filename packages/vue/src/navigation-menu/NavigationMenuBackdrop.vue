<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { usePopupPart } from '../popup/portal';
import { injectNavigationMenuRoot, injectPortal } from './root';
import type { NavigationMenuBackdropProps, NavigationMenuBackdropState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<NavigationMenuBackdropProps>();
defineSlots<{
  default?(scope: { state: NavigationMenuBackdropState }): unknown;
  element?(scope: ElementSlotProps<NavigationMenuBackdropState>): unknown;
}>();

const { popup: root } = injectNavigationMenuRoot('Backdrop');
injectPortal('Backdrop');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const { entered, shown } = usePopupPart(root, element);
const state = computed<NavigationMenuBackdropState>(() => ({ open: root.open }));

function elementProps() {
  const closed = !root.open;
  return mergeProps(
    {
      role: 'presentation',
      hidden: closed && root.keepMounted ? true : undefined,
      inert: closed ? true : undefined,
      style: {
        // The page stays in use under a menu that a hover opened.
        pointerEvents: root.reason === 'trigger-hover' ? 'none' : undefined,
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

<!-- The `element` slot renders a fragment, which takes no `v-show`. -->
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
