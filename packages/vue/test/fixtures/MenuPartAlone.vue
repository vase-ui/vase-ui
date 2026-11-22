<script setup lang="ts">
import type { PropType } from 'vue';
import { ContextMenu } from '../../src/context-menu';
import { Menu } from '../../src/menu';

// A part of `Menu`, or of `ContextMenu` with `context`, at a place: alone, in a root with no
// portal, or in the popup of an open root.
defineProps({
  part: { type: String as PropType<keyof typeof Menu & keyof typeof ContextMenu>, required: true },
  place: { type: String as PropType<'alone' | 'root' | 'popup'>, default: 'root' },
  context: Boolean,
});
</script>

<template>
  <component :is="(context ? ContextMenu : Menu)[part]" v-if="place === 'alone'" />
  <Menu.Root v-else-if="place === 'root'">
    <component :is="Menu[part]" />
  </Menu.Root>
  <Menu.Root v-else default-open>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup>
          <component :is="Menu[part]" />
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
