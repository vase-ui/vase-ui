<script setup lang="ts">
import { Menu } from '../../src/menu';

// A plain menu of its own in the popup of an open filterable menu.
</script>

<template>
  <Menu.FilterProvider>
    <Menu.Root open>
      <Menu.Trigger>Parent</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.Input aria-label="Filter parent" />
            <Menu.List>
              <Menu.Item>Parent action</Menu.Item>
            </Menu.List>
            <Menu.Root default-open>
              <Menu.Trigger data-testid="independent">Independent</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item data-key="independent-action">Independent action</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </Menu.FilterProvider>
</template>
