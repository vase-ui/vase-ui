<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';

type Props = Record<string, unknown>;

// A combobox whose trigger shows `Combobox.Value` in `[data-testid="value"]`, with an input in the
// popup. `valueSlot` fills the default slot of the value: a function of the value gives its text,
// `'markup'` renders bold and italic text, and another string is the text. The items of `items`
// render their label, or their value with no label; a group `{ value, items }` renders its items.
defineProps({
  root: Object as PropType<Props>,
  value: Object as PropType<Props>,
  valueSlot: [Function, String] as PropType<((value: any) => string) | string>,
  items: Array as PropType<unknown[]>,
});

const isGroup = (item: unknown): item is { items: unknown[] } =>
  typeof item === 'object' && item !== null && Array.isArray((item as { items?: unknown }).items);
const textOf = (item: unknown) => {
  if (typeof item !== 'object' || item === null) return String(item);
  const { label, value } = item as { label?: unknown; value?: unknown };
  return typeof label === 'string' ? label : String(value);
};
</script>

<template>
  <Combobox.Root :items="items" v-bind="root">
    <Combobox.Trigger data-testid="trigger">
      <span data-testid="value">
        <Combobox.Value v-if="valueSlot === undefined" v-bind="value" />
        <Combobox.Value v-else v-slot="{ value: current }" v-bind="value">
          <span v-if="valueSlot === 'markup'" data-testid="markup">
            <strong>Bold</strong> and <em>italic</em> text
          </span>
          <template v-else>{{
            typeof valueSlot === 'function' ? valueSlot(current) : valueSlot
          }}</template>
        </Combobox.Value>
      </span>
    </Combobox.Trigger>
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup data-testid="popup">
          <Combobox.Input data-testid="input" />
          <Combobox.List>
            <template #item="{ item }">
              <Combobox.Group v-if="isGroup(item)">
                <Combobox.Item
                  v-for="(each, index) in item.items"
                  :key="index"
                  :value="each"
                  :data-testid="`item-${textOf(each)}`"
                >
                  {{ textOf(each) }}
                </Combobox.Item>
              </Combobox.Group>
              <Combobox.Item v-else :value="item" :data-testid="`item-${textOf(item)}`">
                {{ textOf(item) }}
              </Combobox.Item>
            </template>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
