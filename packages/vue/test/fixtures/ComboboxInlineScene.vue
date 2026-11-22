<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';

type Props = Record<string, unknown>;

// A combobox with its list in place, and a button after it. With `indexes`, each item gets its
// place in `index`. The list has a height of `listHeight` pixels with a scroll, when given.
defineProps({
  root: Object as PropType<Props>,
  items: { type: Array as PropType<string[]>, default: () => ['apple', 'banana', 'cherry'] },
  indexes: Boolean,
  listHeight: Number,
});
</script>

<template>
  <Combobox.Root inline :items="items" v-bind="root">
    <Combobox.Input data-testid="input" aria-label="Fruit" />
    <Combobox.List
      data-testid="list"
      :style="listHeight ? { maxHeight: `${listHeight}px`, overflow: 'auto' } : undefined"
    >
      <template #item="{ item, index }">
        <Combobox.Item
          :value="item"
          :index="indexes ? index : undefined"
          :data-testid="`item-${item}`"
        >
          {{ item }}
        </Combobox.Item>
      </template>
    </Combobox.List>
  </Combobox.Root>
  <button data-testid="after">After</button>
</template>
