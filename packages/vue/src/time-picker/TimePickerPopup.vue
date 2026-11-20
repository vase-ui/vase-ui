<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { usePickerPart, usePopupFocusTargets } from '../common/picker/popup';
import PopoverPopup from '../popover/PopoverPopup.vue';
import { injectTimePicker } from './root';
import type { TimePickerPopupProps, TimePickerPopupState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerPopupProps>(), { initialFocus: undefined });
defineSlots<{
  default?(scope: { state: TimePickerPopupState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TimePickerPopupState;
  }): unknown;
}>();

injectTimePicker('Popup');
const attrs = useAttrs();
const part = usePickerPart();
const initialFocus = usePopupFocusTargets(
  () => props.initialFocus,
  () => part.element.value,
);

function popupProps() {
  return mergeProps(attrs, { initialFocus });
}

defineExpose({ element: part.element });
</script>

<template>
  <PopoverPopup v-if="$slots.element" :ref="part.setPart" v-bind="popupProps()">
    <template #element="scope">
      <slot name="element" v-bind="scope" />
    </template>
  </PopoverPopup>
  <PopoverPopup v-else :ref="part.setPart" v-bind="popupProps()">
    <template #default="{ state }">
      <slot :state="state" />
    </template>
  </PopoverPopup>
</template>
