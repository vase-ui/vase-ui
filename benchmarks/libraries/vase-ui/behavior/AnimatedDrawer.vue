<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <Drawer.Root>
      <Drawer.Trigger data-bench="trigger">Open</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop />
        <Drawer.Viewport>
          <Transition enter-from-class="bench-hidden" leave-to-class="bench-hidden" appear>
            <Drawer.Popup data-bench="popup" class="bench-motion">
              <Drawer.Content>
                <Drawer.Title>Title</Drawer.Title>
                <Drawer.Description>Description</Drawer.Description>
                <Drawer.Close>Close</Drawer.Close>
              </Drawer.Content>
            </Drawer.Popup>
          </Transition>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  </div>
</template>
