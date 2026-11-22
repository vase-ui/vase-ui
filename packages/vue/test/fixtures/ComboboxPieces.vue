<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';

type Props = Record<string, unknown>;

// Small scenes of a few parts, by `scene`:
// - `ChipRemove`: a remove button in the chips, with no chip around it;
// - `GroupLabels`: an open group with the labels of `labels`;
// - `Status`: a status with the text of `text.status`, in an open popup;
// - `InputAnchor`: an open popup beside an input of 120 px and a trigger of 240 px, with no group;
// - `InlineTextarea`: a list in place, with a `<textarea>` in the slot of the input;
// - `InlineNoList`: an open list in place with no item, in an element that records its keys.
defineProps({
  scene: {
    type: String as PropType<
      'ChipRemove' | 'GroupLabels' | 'Status' | 'InputAnchor' | 'InlineTextarea' | 'InlineNoList'
    >,
    required: true,
  },
  labels: { type: Array as PropType<{ key: string; attrs: Props }[]>, default: () => [] },
  text: { type: Object as PropType<{ status: string }>, default: () => ({ status: '' }) },
  as: String,
  positioner: Object as PropType<Props>,
  root: Object as PropType<Props>,
  /** Gets each key that reaches the element around the root. */
  onOuterKey: { type: Function as PropType<(key: string) => void>, default: () => {} },
});
</script>

<template>
  <Combobox.Root v-if="scene === 'ChipRemove'" multiple>
    <Combobox.Chips>
      <Combobox.ChipRemove />
    </Combobox.Chips>
  </Combobox.Root>
  <Combobox.Root v-else-if="scene === 'GroupLabels'" default-open>
    <Combobox.Input />
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup>
          <Combobox.List>
            <Combobox.Group data-testid="group">
              <Combobox.GroupLabel
                v-for="label in labels"
                :key="label.key"
                :data-testid="`label-${label.key}`"
                v-bind="label.attrs"
              >
                {{ label.key }}
              </Combobox.GroupLabel>
              <Combobox.Item value="a">a</Combobox.Item>
            </Combobox.Group>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
  <Combobox.Root v-else-if="scene === 'Status'" default-open>
    <Combobox.Input />
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup>
          <Combobox.Status :as="as as any" data-testid="status">{{ text.status }}</Combobox.Status>
          <Combobox.List>
            <Combobox.Item value="a">a</Combobox.Item>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
  <Combobox.Root v-else-if="scene === 'InlineTextarea'" inline :items="['apple', 'banana']">
    <Combobox.Input>
      <template #element="{ props: inputProps, elementRef }">
        <textarea v-bind="inputProps" :ref="elementRef" data-testid="input" aria-label="Fruit" />
      </template>
    </Combobox.Input>
    <Combobox.List data-testid="list">
      <template #item="{ item }">
        <Combobox.Item :value="item">{{ item }}</Combobox.Item>
      </template>
    </Combobox.List>
  </Combobox.Root>
  <div v-else-if="scene === 'InlineNoList'" @keydown="onOuterKey($event.key)">
    <Combobox.Root inline default-open v-bind="root">
      <Combobox.Input data-testid="input" aria-label="Fruit" />
    </Combobox.Root>
  </div>
  <Combobox.Root v-else default-open>
    <Combobox.Input data-testid="input" style="width: 120px; box-sizing: border-box" />
    <Combobox.Trigger style="width: 240px">Open</Combobox.Trigger>
    <Combobox.Portal>
      <Combobox.Positioner v-bind="positioner">
        <Combobox.Popup>
          <Combobox.List>
            <Combobox.Item value="One">One</Combobox.Item>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
