<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';
</script>

<template>
  <main>
    <Drawer.Provider>
      <Drawer.IndentBackground data-testid="indent-background" />
      <Drawer.Indent data-testid="indent">
        <Drawer.Root>
          <Drawer.Trigger data-testid="closed-trigger">Closed drawer</Drawer.Trigger>
          <Drawer.SwipeArea data-testid="swipe-area" />
          <Drawer.Portal>
            <Drawer.Backdrop />
            <Drawer.Viewport>
              <Drawer.Popup data-testid="closed-popup">
                <Drawer.Content>
                  <Drawer.Title>Closed title</Drawer.Title>
                  <Drawer.Description>Closed description</Drawer.Description>
                  <Drawer.Close>Close</Drawer.Close>
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
        <Drawer.Root
          default-open
          default-trigger-id="open-trigger"
          :modal="false"
          :snap-points="['200px', 1]"
        >
          <Drawer.Trigger id="open-trigger" data-testid="open-trigger">Open drawer</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="open-popup" :initial-focus="false">
                <Drawer.Content>
                  <Drawer.Title>Open title</Drawer.Title>
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Indent>
    </Drawer.Provider>
  </main>
</template>
