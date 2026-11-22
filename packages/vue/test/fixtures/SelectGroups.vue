<script setup lang="ts">
import type { PropType } from 'vue';
import { Select } from '../../src/select';

type Props = Record<string, unknown>;
type Label = { key: string; text: string; attrs?: Props };
type Group = { name: string; labels?: Label[]; items: string[] };

// A select whose popup holds groups. Each group renders its labels, then one item for each value,
// with the value as its text. A separator stands between two groups.
defineProps({
  root: Object as PropType<Props>,
  groups: {
    type: Array as PropType<Group[]>,
    default: () => [
      { name: 'fruits', labels: [{ key: 'fruits', text: 'Fruits' }], items: ['apple', 'banana'] },
      {
        name: 'vegetables',
        labels: [{ key: 'vegetables', text: 'Vegetables' }],
        items: ['carrot', 'leek'],
      },
    ],
  },
});
</script>

<template>
  <Select.Root v-bind="root">
    <Select.Trigger data-testid="trigger"><Select.Value data-testid="value" /></Select.Trigger>
    <Select.Portal>
      <Select.Positioner :align-item-with-trigger="false">
        <Select.Popup data-testid="popup">
          <template v-for="(group, index) in groups" :key="group.name">
            <Select.Separator v-if="index > 0" />
            <Select.Group :data-testid="`group-${group.name}`">
              <Select.GroupLabel
                v-for="label in group.labels ?? []"
                :key="label.key"
                :data-testid="`label-${label.key}`"
                v-bind="label.attrs"
                >{{ label.text }}</Select.GroupLabel
              >
              <Select.Item
                v-for="value in group.items"
                :key="value"
                :value="value"
                :data-testid="`item-${value}`"
                ><Select.ItemText>{{ value }}</Select.ItemText></Select.Item
              >
            </Select.Group>
          </template>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
</template>
