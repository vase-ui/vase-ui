<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';

const demoDrawer = Drawer.createHandle<{ title: string }>();
</script>

<template>
  <Drawer.Trigger :handle="demoDrawer" :payload="{ title: 'Profile' }">Profile</Drawer.Trigger>
  <Drawer.Trigger :handle="demoDrawer" :payload="{ title: 'Settings' }">Settings</Drawer.Trigger>

  <Drawer.Root :handle="demoDrawer">
    <template #default="{ payload }">
      <Drawer.Portal>
        <Drawer.Viewport>
          <Drawer.Popup>
            <Drawer.Content>
              <Drawer.Title>{{ payload?.title }}</Drawer.Title>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </template>
  </Drawer.Root>
</template>
