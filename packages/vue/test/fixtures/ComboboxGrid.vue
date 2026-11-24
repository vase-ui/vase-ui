<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';

// A grid of emojis in rows of three. The last row is shorter. With `grouped`, the rows are in one
// group with a label.
defineProps({
  root: Object as PropType<Record<string, unknown>>,
  input: Object as PropType<Record<string, unknown>>,
  dir: String,
  grouped: Boolean,
});
const ROWS = [
  ['a1', 'a2', 'a3'],
  ['b1', 'b2', 'b3'],
  ['c1', 'c2'],
];
</script>

<template>
  <Combobox.Root grid inline :items="ROWS.flat()" v-bind="root">
    <Combobox.Input data-testid="input" v-bind="input" />
    <Combobox.List :dir="dir">
      <Combobox.Group v-if="grouped" data-testid="group">
        <Combobox.GroupLabel>Cells</Combobox.GroupLabel>
        <Combobox.Row v-for="row in ROWS" :key="row[0]">
          <Combobox.Item
            v-for="cell in row"
            :key="cell"
            :value="cell"
            :data-testid="`item-${cell}`"
          >
            {{ cell }}
          </Combobox.Item>
        </Combobox.Row>
      </Combobox.Group>
      <template v-else>
        <Combobox.Row v-for="row in ROWS" :key="row[0]">
          <Combobox.Item
            v-for="cell in row"
            :key="cell"
            :value="cell"
            :data-testid="`item-${cell}`"
          >
            {{ cell }}
          </Combobox.Item>
        </Combobox.Row>
      </template>
    </Combobox.List>
  </Combobox.Root>
</template>
