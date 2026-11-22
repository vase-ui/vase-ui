<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Select } from '../../src/select';

type Props = Record<string, unknown>;
type Item = { value: unknown; text: string; label?: string; disabled?: boolean; attrs?: Props };

// A select with a label, a trigger with its value and icon, and a popup with one item for each
// entry of `items`, with the attributes of its `attrs`. Text inputs stand before and after the
// root, and a button at the bottom right of the view is outside. The parts and the elements that
// their props name render too.
defineProps({
  root: Object as PropType<Props>,
  label: Object as PropType<Props>,
  /** A label after the trigger. */
  labelAfter: Object as PropType<Props>,
  trigger: Object as PropType<Props>,
  value: Object as PropType<Props>,
  portal: Object as PropType<Props>,
  positioner: { type: Object as PropType<Props>, default: () => ({ alignItemWithTrigger: false }) },
  popup: Object as PropType<Props>,
  backdrop: Object as PropType<Props>,
  arrow: Object as PropType<Props>,
  list: Object as PropType<Props>,
  /**
   * A part set to `false` leaves: `value` and `popup` unmount, and `list` replaces the
   * `Select.List` of `list` with a `<div>`.
   */
  show: {
    type: Object as PropType<{ value?: boolean; popup?: boolean; list?: boolean }>,
    default: () => ({}),
  },
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
  /** A separator after the items, with these props. */
  separator: Object as PropType<Props>,
  /** A `<p>` in the popup before the list, and one after it, with these props. */
  heading: Object as PropType<Props>,
  footer: Object as PropType<Props>,
  noPortal: Boolean,
  /** The default slot of `Select.Value`: a text, or a function of the value that gives the text. */
  valueSlot: [String, Function] as PropType<string | ((value: unknown) => string)>,
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
      <Select.Value
        v-if="show.value !== false && valueSlot !== undefined"
        v-slot="{ value: current }"
        data-testid="value"
        v-bind="value"
        >{{ typeof valueSlot === 'function' ? valueSlot(current) : valueSlot }}</Select.Value
      >
      <Select.Value v-else-if="show.value !== false" data-testid="value" v-bind="value" />
      <Select.Icon />
    </Select.Trigger>
    <Select.Label v-if="labelAfter" data-testid="label" v-bind="labelAfter">Fruit</Select.Label>
    <Select.Portal v-if="!noPortal" v-bind="portal">
      <Select.Backdrop v-if="backdrop" data-testid="backdrop" v-bind="backdrop" />
      <Select.Positioner data-testid="positioner" v-bind="positioner">
        <Select.Popup
          v-if="show.popup !== false"
          ref="popupPart"
          data-testid="popup"
          v-bind="popup"
        >
          <Select.Arrow v-if="arrow" data-testid="arrow" v-bind="arrow" />
          <Select.ScrollUpArrow v-if="arrows" data-testid="up" v-bind="arrows" />
          <p v-if="heading" data-testid="heading" v-bind="heading">Fruits</p>
          <component
            :is="list && show.list !== false ? Select.List : 'div'"
            data-testid="list"
            v-bind="list"
          >
            <Select.Item
              v-for="item in items"
              :key="typeof item.value === 'object' && item.value ? item.text : String(item.value)"
              v-bind="item.attrs"
              :value="item.value"
              :label="item.label"
              :disabled="item.disabled"
              :data-testid="`item-${String(item.value)}`"
              v-slot="{ state }"
            >
              <Select.ItemText>{{ item.text }}</Select.ItemText>
              <span :data-state="JSON.stringify(state)" />
            </Select.Item>
          </component>
          <Select.Separator v-if="separator" data-testid="separator" v-bind="separator" />
          <p v-if="footer" data-testid="footer" v-bind="footer">More soon</p>
          <Select.ScrollDownArrow v-if="arrows" data-testid="down" v-bind="arrows" />
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
  <input id="after" aria-label="After" />
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
