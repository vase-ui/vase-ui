<script setup lang="ts">
import { mergeProps, onUnmounted, provide, shallowReactive, useAttrs } from 'vue';
import { byDocumentOrder, useElement, type ElementSlotProps } from '../common/element';
import { ownerWindow } from '../common/owner';
import { chipsKey, injectComboboxRoot, pressAroundInput, type ChipsContext } from './root';
import type { ComboboxChipsProps, ComboboxChipsState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ComboboxChipsProps>();
defineSlots<{
  default?(scope: { state: ComboboxChipsState }): unknown;
  element?(scope: ElementSlotProps<ComboboxChipsState>): unknown;
}>();

const context = injectComboboxRoot('Chips');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
// Nuxt removes `onUnmounted` from its server build, with its arguments.
const removeInside = context.addInside(() => element.value);
onUnmounted(removeInside);
const chips = shallowReactive<HTMLElement[]>([]);
const state: ComboboxChipsState = {};

function ordered() {
  return chips.filter((chip) => chip.isConnected).sort(byDocumentOrder);
}

const chipsContext: ChipsContext = {
  rtl() {
    const el = element.value;
    return !!el && ownerWindow(el).getComputedStyle(el).direction === 'rtl';
  },
  focusChip(index) {
    const chip = ordered().at(index);
    chip?.focus();
    return !!chip;
  },
  addChip(chip) {
    chips.push(chip);
    return () => {
      const at = chips.indexOf(chip);
      if (at !== -1) chips.splice(at, 1);
    };
  },
  indexOf: (chip) => ordered().indexOf(chip),
};
provide(chipsKey, chipsContext);

const onMousedown = (event: MouseEvent) => pressAroundInput(context, event);

function elementProps() {
  return mergeProps({ role: context.hasValue ? 'toolbar' : undefined, onMousedown }, attrs);
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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
