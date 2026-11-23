<script setup lang="ts">
import { computed, mergeProps, useAttrs, useId } from 'vue';
import { useAsTag, useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { ownerWindow } from '../common/owner';
import { usePopupHover } from '../popup/hover';
import { usePopupTrigger } from '../popup/trigger';
import { useKeyGroupItem } from './keys';
import { injectItem, injectNavigationMenuRoot } from './root';
import type { NavigationMenuTriggerProps, NavigationMenuTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuTriggerProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: NavigationMenuTriggerState }): unknown;
  element?(scope: ElementSlotProps<NavigationMenuTriggerState>): unknown;
}>();

const root = injectNavigationMenuRoot('Trigger');
const item = injectItem('Trigger');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const popup = () => root.popup;
useKeyGroupItem(element);

const hover = usePopupHover(popup, {
  trigger: element,
  enabled: () => true,
  // An open menu, or a menu that leaves, goes to another trigger at once.
  delay: () => (root.popup.open || root.leaving ? 0 : root.delay),
  closeDelay: () => root.closeDelay,
  inside: (target) => root.inside(target),
  closes: () => !root.inline,
});
const trigger = usePopupTrigger(popup, {
  element,
  id: () => givenId(props.id) ?? generatedId,
  payload: () => item.value,
  disabled: () => props.disabled,
  tag: useAsTag(() => props.as, 'button'),
  // An inline root closes only by a link, by code or by its model.
  closesAtPress: (event) => !root.inline && hover.closesAtPress(event),
  focusableWhenDisabled: () => true,
});

const state = computed<NavigationMenuTriggerState>(() => ({
  open: trigger.open.value,
  disabled: trigger.button.disabled.value,
}));

// The key that opens the item: down in a horizontal root, and the side of the text end in a
// vertical one. The focus stays on the trigger.
function onKeydown(event: KeyboardEvent) {
  const target = event.currentTarget as HTMLElement;
  if (root.nested || trigger.button.disabled.value || event.target !== target) return;
  const rtl = ownerWindow(target).getComputedStyle(target).direction === 'rtl';
  const key = root.orientation === 'vertical' ? (rtl ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown';
  if (event.key !== key) return;
  event.preventDefault();
  event.stopPropagation();
  root.popup.request(true, 'list-navigation', event, target);
}

function elementProps() {
  const contentId = item.contentId;
  return trigger.button.mergeAttributes(
    mergeProps(hover.listeners, {
      id: givenId(props.id) ?? generatedId,
      'aria-expanded': trigger.open.value ? 'true' : 'false',
      'aria-controls': trigger.open.value && contentId ? contentId : undefined,
      onClick: trigger.onClick,
      onKeydown,
    }),
    attrs,
  );
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
