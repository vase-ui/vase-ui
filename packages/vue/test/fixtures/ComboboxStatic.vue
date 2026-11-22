<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';
import { Field } from '../../src/field';

type Props = Record<string, unknown>;

// A combobox with no `items`: the list renders an item for each entry of `items`, in a `v-for`.
// With `inputInPopup`, the trigger is the control, shows `Combobox.Value`, and the input is in the
// popup; else the input is the control, with a trigger after it when `trigger` is set. With
// `indexes`, each item gets its place in `index`. With `field`, the root is in a `Field.Root` with
// these props. `texts` gives the text that an item renders, by its value.
defineProps({
  root: Object as PropType<Props>,
  items: { type: Array as PropType<unknown[]>, default: () => ['apple', 'banana', 'cherry'] },
  inputInPopup: Boolean,
  trigger: Object as PropType<Props>,
  input: Object as PropType<Props>,
  value: Object as PropType<Props>,
  portal: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  indexes: Boolean,
  itemProps: Object as PropType<Record<string, Props>>,
  field: Object as PropType<Props>,
  texts: Object as PropType<Record<string, string>>,
});

const textOf = (item: unknown) =>
  typeof item === 'object' && item !== null
    ? String((item as { label?: unknown }).label)
    : String(item);
</script>

<template>
  <component :is="field ? Field.Root : 'div'" v-bind="field">
    <Combobox.Root v-bind="root">
      <Combobox.Trigger v-if="inputInPopup" data-testid="trigger" v-bind="trigger">
        <Combobox.Value v-bind="value" />
      </Combobox.Trigger>
      <template v-else>
        <Combobox.Input data-testid="input" v-bind="input" />
        <Combobox.Trigger v-if="trigger" data-testid="trigger" v-bind="trigger">
          Open
        </Combobox.Trigger>
      </template>
      <Combobox.Portal v-bind="portal">
        <Combobox.Positioner data-testid="positioner">
          <Combobox.Popup data-testid="popup" v-bind="popup">
            <Combobox.Input v-if="inputInPopup" data-testid="input" v-bind="input" />
            <Combobox.List data-testid="list">
              <Combobox.Item
                v-for="(each, index) in items"
                :key="textOf(each)"
                :value="each"
                :index="indexes ? index : undefined"
                :data-testid="`item-${textOf(each)}`"
                v-bind="itemProps?.[textOf(each)]"
              >
                {{ texts?.[textOf(each)] ?? textOf(each) }}
              </Combobox.Item>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  </component>
  <button id="outside">Outside</button>
</template>
