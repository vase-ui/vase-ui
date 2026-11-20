<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Select } from '../../src/select';

type Props = Record<string, unknown>;
type Item = { value: unknown; text: string; label?: string; disabled?: boolean };

// A select with a label, a trigger with its value and icon, and a popup with one item for each
// entry of `items`. Text inputs stand before and after the root, and a button at the bottom right
// of the view is outside. The parts that their props name render too.
defineProps({
  root: Object as PropType<Props>,
  label: Object as PropType<Props>,
  trigger: Object as PropType<Props>,
  value: Object as PropType<Props>,
  portal: Object as PropType<Props>,
  positioner: { type: Object as PropType<Props>, default: () => ({ alignItemWithTrigger: false }) },
  popup: Object as PropType<Props>,
  backdrop: Object as PropType<Props>,
  arrow: Object as PropType<Props>,
  list: Object as PropType<Props>,
  items: {
    type: Array as PropType<Item[]>,
    default: () => [
      { value: 'apple', text: 'Apple' },
      { value: 'apricot', text: 'Apricot' },
      { value: 'banana', text: 'Banana' },
      { value: 'cherry', text: 'Cherry' },
    ],
  },
  /** The scroll arrows. */
  arrows: Object as PropType<Props>,
  noPortal: Boolean,
});
const rootPart = useTemplateRef('rootPart');
const popupPart = useTemplateRef('popupPart');
defineExpose({ root: rootPart, popup: popupPart });
</script>

<template>
  <input id="before" aria-label="Before" />
  <Select.Root ref="rootPart" data-testid="root" v-bind="root">
    <Select.Label v-if="label" data-testid="label" v-bind="label">Fruit</Select.Label>
    <Select.Trigger data-testid="trigger" v-bind="trigger">
      <Select.Value data-testid="value" v-bind="value" />
      <Select.Icon />
    </Select.Trigger>
    <Select.Portal v-if="!noPortal" v-bind="portal">
      <Select.Backdrop v-if="backdrop" data-testid="backdrop" v-bind="backdrop" />
      <Select.Positioner data-testid="positioner" v-bind="positioner">
        <Select.Popup ref="popupPart" data-testid="popup" v-bind="popup">
          <Select.Arrow v-if="arrow" data-testid="arrow" v-bind="arrow" />
          <Select.ScrollUpArrow v-if="arrows" data-testid="up" v-bind="arrows" />
          <component :is="list ? Select.List : 'div'" data-testid="list" v-bind="list">
            <Select.Item
              v-for="item in items"
              :key="String(item.value)"
              :value="item.value"
              :label="item.label"
              :disabled="item.disabled"
              :data-testid="`item-${String(item.value)}`"
            >
              <Select.ItemText>{{ item.text }}</Select.ItemText>
            </Select.Item>
          </component>
          <Select.ScrollDownArrow v-if="arrows" data-testid="down" v-bind="arrows" />
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
  <input id="after" aria-label="After" />
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
