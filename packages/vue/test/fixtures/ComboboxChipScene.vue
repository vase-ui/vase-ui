<script setup lang="ts">
import { shallowRef, type PropType } from 'vue';
import { Combobox } from '../../src/combobox';
import { Field } from '../../src/field';

type Props = Record<string, unknown>;

// A multiple combobox with a chip for each value that `Combobox.Value` gives, and a button before
// it. `layout` puts the input:
// - `inside`: in the chips, after them;
// - `before`: before the chips;
// - `group`: in the chips, in an input group with a padding of 10 px;
// - `popup`: in the popup, with a trigger after the chips;
// - `whileOpen`: in the chips while the popup is open, which the fixture holds.
// `chips` is the number of chips to render; `0` renders a count of the values in place of chips.
defineProps({
  root: Object as PropType<Props>,
  items: { type: Array as PropType<string[]>, default: () => ['apple', 'banana', 'cherry'] },
  layout: {
    type: String as PropType<'inside' | 'before' | 'group' | 'popup' | 'whileOpen'>,
    default: 'inside',
  },
  chips: { type: Number, default: Infinity },
  /** Each chip has a remove button with these props. */
  remove: Object as PropType<Props>,
  /** The root is in a `Field.Root` with these props. */
  field: Object as PropType<Props>,
});
const open = shallowRef(true);
</script>

<template>
  <button data-testid="outside">Outside</button>
  <component :is="field ? Field.Root : 'div'" v-bind="field">
    <Combobox.Root
      :items="items"
      multiple
      v-bind="
        layout === 'whileOpen'
          ? { open, 'onUpdate:open': (value: boolean) => (open = value), ...root }
          : root
      "
    >
      <Combobox.Input v-if="layout === 'before'" data-testid="input" />
      <component
        :is="layout === 'group' ? Combobox.InputGroup : 'div'"
        data-testid="group"
        style="padding: 10px"
      >
        <Combobox.Chips data-testid="chips">
          <Combobox.Value v-slot="{ value }">
            <template v-if="chips === 0">+{{ (value as string[]).length }} selected</template>
            <Combobox.Chip
              v-for="each in (value as string[]).slice(0, chips)"
              v-else
              :key="each"
              :data-testid="`chip-${each}`"
            >
              {{ each }}
              <Combobox.ChipRemove
                v-if="remove"
                :data-testid="`remove-${each}`"
                aria-label="Remove"
                v-bind="remove"
              />
            </Combobox.Chip>
          </Combobox.Value>
          <Combobox.Input
            v-if="layout === 'inside' || layout === 'group' || (layout === 'whileOpen' && open)"
            data-testid="input"
          />
        </Combobox.Chips>
      </component>
      <Combobox.Trigger v-if="layout === 'popup'" data-testid="trigger">Open</Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup data-testid="popup">
            <Combobox.Input v-if="layout === 'popup'" data-testid="input" />
            <Combobox.List data-testid="list">
              <template #item="{ item }">
                <Combobox.Item :value="item" :data-testid="`item-${item}`">{{
                  item
                }}</Combobox.Item>
              </template>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  </component>
</template>
