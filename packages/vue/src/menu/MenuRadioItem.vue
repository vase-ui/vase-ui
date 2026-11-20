<script setup lang="ts" generic="Value = unknown">
import { computed, useAttrs } from 'vue';
import { useAsTag, useElement } from '../common/element';
import { useMenuItem } from './item';
import { injectRadioGroup } from './radio';
import type { MenuRadioItemProps, MenuRadioItemState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuRadioItemProps<Value>>(), {
  disabled: false,
  closeOnClick: false,
});
defineSlots<{
  default?(scope: { state: MenuRadioItemState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: MenuRadioItemState;
  }): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const group = injectRadioGroup();
const item = useMenuItem({
  part: 'RadioItem',
  element,
  id: () => props.id,
  label: () => props.label,
  disabled: () => props.disabled || group.disabled,
  tag: useAsTag(() => props.as),
  role: 'menuitemradio',
});
const checked = computed(() => Object.is(group.value, props.value));
const state = computed<MenuRadioItemState>(() => ({
  checked: checked.value,
  disabled: item.disabled.value,
  highlighted: item.highlighted.value,
}));

function onClick(event: MouseEvent) {
  group.select(props.value, event);
  if (props.closeOnClick) item.menu.close('item-press', event);
}

function elementProps() {
  return item.mergeAttributes({ 'aria-checked': checked.value ? 'true' : 'false', onClick }, attrs);
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
