<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
</script>

<template>
  <Menu.FilterProvider>
    <Menu.Root>
      <Menu.Trigger />
      <Menu.Portal>
        <Menu.Backdrop />
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.Arrow />
            <Menu.Input />
            <Menu.Clear />
            <Menu.Empty />

            <Menu.List>
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
                <Menu.GroupLabel />
                <Menu.RadioItem value="" />
              </Menu.RadioGroup>

              <Menu.CheckboxItem />
            </Menu.List>

            <Menu.Viewport />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </Menu.FilterProvider>
</template>
