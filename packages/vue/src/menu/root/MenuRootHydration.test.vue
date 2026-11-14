<script setup lang="ts">
import MenuItem from '../item/MenuItem.vue';
import MenuPopup from '../popup/MenuPopup.vue';
import MenuPortal from '../portal/MenuPortal.vue';
import MenuPositioner from '../positioner/MenuPositioner.vue';
import { createMenuHandle } from '../store/MenuHandle';
import MenuTrigger from '../trigger/MenuTrigger.vue';
import MenuRoot from './MenuRoot.vue';

// A server shares a handle between requests, so it attaches no store to it.
const handle = createMenuHandle<string>();
</script>

<template>
  <MenuRoot default-open default-trigger-id="in-root">
    <MenuTrigger id="in-root">Open</MenuTrigger>
    <MenuPortal>
      <MenuPositioner>
        <MenuPopup>
          <MenuItem>Item</MenuItem>
        </MenuPopup>
      </MenuPositioner>
    </MenuPortal>
  </MenuRoot>
  <MenuTrigger id="detached" :handle="handle" payload="detached">Detached</MenuTrigger>
  <MenuRoot :handle="handle">
    <MenuPortal>
      <MenuPositioner>
        <MenuPopup>
          <MenuItem>Item</MenuItem>
        </MenuPopup>
      </MenuPositioner>
    </MenuPortal>
  </MenuRoot>
</template>
