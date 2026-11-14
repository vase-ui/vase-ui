<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
</script>

<template>
  <Menu.Root>
    <Menu.Trigger />
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup>
          <Menu.Item />

          <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger />
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item />
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.SubmenuRoot>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
