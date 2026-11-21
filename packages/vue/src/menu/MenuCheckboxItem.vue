<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useAsTag, useElement, type ElementSlotProps } from '../common/element';
import { useModel } from '../common/model';
import { useMenuItem } from './item';
import type { MenuCheckboxItemEmits, MenuCheckboxItemProps, MenuCheckboxItemState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuCheckboxItemProps>(), {
  modelValue: undefined,
  defaultChecked: false,
  disabled: false,
  closeOnClick: false,
});
const emit = defineEmits<MenuCheckboxItemEmits>();
defineSlots<{
  default?(scope: { state: MenuCheckboxItemState }): unknown;
  element?(scope: ElementSlotProps<MenuCheckboxItemState>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const checked = useModel(() => props.modelValue, props.defaultChecked);
const item = useMenuItem({
  part: 'CheckboxItem',
  element,
  id: () => props.id,
  label: () => props.label,
  disabled: () => props.disabled,
  tag: useAsTag(() => props.as ?? 'div'),
  role: 'menuitemcheckbox',
});
const state = computed<MenuCheckboxItemState>(() => ({
  checked: checked.value.value,
  disabled: item.disabled.value,
  highlighted: item.highlighted.value,
}));

function onClick(event: MouseEvent) {
  const next = !checked.value.value;
  const details = createChangeEventDetails('item-press' as const, event);
  emit('checkedChange', next, details);
  if (!details.isCanceled) {
    checked.setOwn(next);
    emit('update:modelValue', next);
  }
  if (props.closeOnClick) item.menu.close('item-press', event);
}

function elementProps() {
  return item.mergeAttributes(
    { 'aria-checked': checked.value.value ? 'true' : 'false', onClick },
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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
