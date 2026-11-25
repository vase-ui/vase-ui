<script setup lang="ts">
import type { PropType } from 'vue';
import { Autocomplete } from '../../src/autocomplete';
import { Field } from '../../src/field';

type Props = Record<string, unknown>;

// An autocomplete of tags in a native form. With `inputInPopup`, a trigger opens the popup, and the
// input is in it. `items` replaces the tags, `input` and `list` give props to their parts, and
// `onItemClick` listens to the `click` of each item. With `field`, the root is in a `Field.Root`
// with these props, a label, a description and an error. `valueSlot` formats the text of
// Autocomplete.Value. A text input stands after the form.
defineProps({
  root: Object as PropType<Props>,
  inputInPopup: Boolean,
  items: { type: Array as PropType<unknown[]>, default: () => ['feature', 'fix', 'docs', 'chore'] },
  input: Object as PropType<Props>,
  portal: Object as PropType<Props>,
  backdrop: Object as PropType<Props>,
  list: Object as PropType<Props>,
  field: Object as PropType<Props>,
  clear: Boolean,
  onItemClick: Function as PropType<(item: unknown) => void>,
  valueSlot: Function as PropType<(value: string) => string>,
});
const textOf = (item: unknown) =>
  typeof item === 'object' && item
    ? String(
        (item as { label?: unknown; value?: unknown }).label ?? (item as { value?: unknown }).value,
      )
    : String(item);
</script>

<template>
  <form data-testid="form">
    <component :is="field ? Field.Root : 'div'" data-testid="field" v-bind="field">
      <Field.Label v-if="field" data-testid="label">Tag</Field.Label>
      <Autocomplete.Root :items="items" v-bind="root">
        <template v-if="inputInPopup">
          <Autocomplete.Trigger data-testid="trigger">
            <Autocomplete.Value v-if="valueSlot" v-slot="{ value }">{{
              valueSlot(value)
            }}</Autocomplete.Value>
            <Autocomplete.Value v-else />
          </Autocomplete.Trigger>
        </template>
        <Autocomplete.InputGroup v-else data-testid="group">
          <Autocomplete.Input data-testid="input" v-bind="input" />
          <Autocomplete.Clear v-if="clear" data-testid="clear" />
        </Autocomplete.InputGroup>
        <Autocomplete.Portal v-bind="portal">
          <Autocomplete.Backdrop v-if="backdrop" data-testid="backdrop" v-bind="backdrop" />
          <Autocomplete.Positioner>
            <Autocomplete.Popup data-testid="popup">
              <Autocomplete.Input v-if="inputInPopup" data-testid="input" v-bind="input" />
              <Autocomplete.List data-testid="list" v-bind="list">
                <template #item="{ item }">
                  <Autocomplete.Item
                    :value="item"
                    :data-testid="`item-${textOf(item)}`"
                    @click="onItemClick?.(item)"
                  >
                    {{ textOf(item) }}
                  </Autocomplete.Item>
                </template>
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
      <Field.Description v-if="field" id="description">Pick a tag.</Field.Description>
      <Field.Error v-if="field" id="error" />
    </component>
    <button id="submit-button">Submit</button>
  </form>
  <input id="outside" aria-label="Outside" />
</template>
