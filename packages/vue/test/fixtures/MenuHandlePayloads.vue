<script setup lang="ts">
import { ref } from 'vue';
import { Menu, type MenuRootChangeEventDetails } from '../../src/menu';

// A controlled root of a handle with three triggers outside it. The change details give the
// trigger id, and the item shows the payload of the active trigger. Two buttons open the menu:
// one through the props, one through the handle. The menu is not modal, so a press reaches each
// trigger while it is open.
const handle = Menu.createHandle<string>();
const open = ref(false);
const triggerId = ref<string | null>(null);

function onOpenChange(next: boolean, details: MenuRootChangeEventDetails) {
  open.value = next;
  triggerId.value = details.trigger?.id ?? null;
}

function openExternally() {
  open.value = true;
  triggerId.value = 'second-trigger';
}
</script>

<template>
  <Menu.Root
    :handle="handle"
    :open="open"
    :trigger-id="triggerId"
    :modal="false"
    @open-change="onOpenChange"
  >
    <template #default="{ payload }">
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup data-testid="popup">
            <Menu.Item data-key="item">{{ payload }}</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </template>
  </Menu.Root>
  <Menu.Trigger :handle="handle" payload="Library">Library</Menu.Trigger>
  <Menu.Trigger id="second-trigger" :handle="handle" payload="Playback">Playback</Menu.Trigger>
  <Menu.Trigger :handle="handle" payload="Sharing">Sharing</Menu.Trigger>
  <button data-testid="external" @click="openExternally">Open externally</button>
  <button data-testid="via-handle" @click="handle.open('second-trigger')">Open via handle</button>
</template>
