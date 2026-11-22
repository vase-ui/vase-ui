<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';

// A modal menu of five items that counts the renders of each part with a call in its slot.
defineProps({
  count: { type: Function as PropType<(part: string) => string>, required: true },
});
const ITEMS = ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5'];
</script>

<template>
  <Menu.Root>
    <Menu.Trigger data-testid="trigger">Open</Menu.Trigger>
    <Menu.Portal>
      {{ count('portal') }}
      <Menu.Positioner>
        {{ count('positioner') }}
        <Menu.Popup>
          <Menu.Item v-for="item in ITEMS" :key="item">{{ count('item') }}{{ item }}</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
