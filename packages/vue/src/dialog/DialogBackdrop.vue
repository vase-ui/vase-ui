<script setup lang="ts">
import { computed, mergeProps, useAttrs, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { keepFocus, usePopupPart } from '../popup/portal';
import { injectDialog, injectDialogPortal } from './root';
import type { DialogBackdropProps, DialogBackdropState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogBackdropProps>(), { forceRender: false });
defineSlots<{
  default?(scope: { state: DialogBackdropState }): unknown;
  element?(scope: ElementSlotProps<DialogBackdropState>): unknown;
}>();

const context = injectDialog('Backdrop');
injectDialogPortal('Backdrop', context);
const { root } = context;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const { entered, shown } = usePopupPart(root, element);
// While another dialog is under it, the backdrop of a nested dialog would darken the page twice.
const rendered = computed(() => props.forceRender || !context.nested);
const state = computed<DialogBackdropState>(() => ({ open: root.open }));

watch(element, (backdrop, _, onCleanup) => {
  if (backdrop) onCleanup(context.addBackdrop());
});

function elementProps() {
  const closed = !root.open;
  return mergeProps(
    {
      role: 'presentation',
      hidden: closed && root.keepMounted ? true : undefined,
      inert: closed ? true : undefined,
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
