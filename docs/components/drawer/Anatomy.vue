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
          <Transition name="fade">
            <Drawer.Backdrop />
          </Transition>
          <Drawer.Viewport>
            <Transition name="sheet">
              <Drawer.Popup>
                <Drawer.Content>
                  <Drawer.Title />
                  <Drawer.Description />
                  <Drawer.Close />
                </Drawer.Content>
              </Drawer.Popup>
            </Transition>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </Drawer.Indent>
  </Drawer.Provider>
</template>
