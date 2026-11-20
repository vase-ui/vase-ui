<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
import { Menubar } from '@vase-ui/vue/menubar';
</script>

<template>
  <Menubar>
    <Menu.Root>
      <Menu.Trigger />
      <Menu.Portal>
        <Menu.Backdrop />
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.Arrow />
            <Menu.Item />
            <Menu.LinkItem />
            <Menu.Separator />

            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger />
            </Menu.SubmenuRoot>

            <Menu.Group>
              <Menu.GroupLabel />
            </Menu.Group>

            <Menu.RadioGroup>
              <Menu.RadioItem value="" />
            </Menu.RadioGroup>

            <Menu.CheckboxItem />

            <Menu.Viewport />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </Menubar>
</template>
