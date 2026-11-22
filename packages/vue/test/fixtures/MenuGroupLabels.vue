<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';

type Props = Record<string, unknown>;

// An open menu with no trigger, and a group with a label for each id of `state.labels`. With
// `radio`, the group is a radio group.
defineProps({
  state: {
    type: Object as PropType<{ labels: string[]; label?: Props }>,
    required: true,
  },
  radio: Boolean,
});
</script>

<template>
  <Menu.Root default-open :modal="false">
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup>
          <component :is="radio ? Menu.RadioGroup : Menu.Group" data-testid="group">
            <Menu.GroupLabel v-for="id in state.labels" :id="id" :key="id" v-bind="state.label">
              {{ id }}
            </Menu.GroupLabel>
            <Menu.Item>Item</Menu.Item>
          </component>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
