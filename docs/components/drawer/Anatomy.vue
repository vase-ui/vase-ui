<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';
</script>

<template>
  <Drawer.Provider>
    <Drawer.IndentBackground />
    <Drawer.Indent>
      <Drawer.Root>
        <Drawer.Trigger />
        <Drawer.SwipeArea />
        <Drawer.Portal>
          <Drawer.Backdrop />
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Content>
                <Drawer.Title />
                <Drawer.Description />
                <Drawer.Close />
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </Drawer.Indent>
  </Drawer.Provider>
</template>
