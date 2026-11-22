<script setup lang="ts">
import { Menu } from '../../src/menu';
import { Menubar } from '../../src/menubar';
import { Select } from '../../src/select';

// A menu with a submenu, a menubar with a menu in it and a menu whose trigger is in it with a
// handle, or a select. Each popup has an `id`.
defineProps<{ scene: 'menu' | 'menubar' | 'select' }>();
const handle = Menu.createHandle();
</script>

<template>
  <Menu.Root v-if="scene === 'menu'">
    <Menu.Trigger data-testid="trigger">Menu</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup id="menu-popup">
          <Menu.Item>One</Menu.Item>
          <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger data-testid="submenu-trigger">More</Menu.SubmenuTrigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup id="submenu-popup">
                  <Menu.Item>Two</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.SubmenuRoot>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
  <template v-else-if="scene === 'menubar'">
    <Menubar data-testid="bar">
      <Menu.Root>
        <Menu.Trigger data-testid="file">File</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup id="file-popup">
              <Menu.Item>Open</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Menu.Trigger :handle="handle" data-testid="edit">Edit</Menu.Trigger>
    </Menubar>
    <Menu.Root :handle="handle">
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup id="edit-popup">
            <Menu.Item>Copy</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </template>
  <Select.Root v-else>
    <Select.Trigger data-testid="trigger"><Select.Value placeholder="Pick" /></Select.Trigger>
    <Select.Portal>
      <Select.Positioner>
        <Select.Popup id="select-popup">
          <Select.Item value="a">A</Select.Item>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
</template>
