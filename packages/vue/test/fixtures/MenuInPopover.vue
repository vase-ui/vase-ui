<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';
import { Popover } from '../../src/popover';

type Props = Record<string, unknown>;

// A menu in a popover, with a second popover in the menu.
defineProps({
  popover: Object as PropType<Props>,
  root: Object as PropType<Props>,
  inner: Object as PropType<Props>,
});
</script>

<template>
  <Popover.Root v-bind="popover">
    <Popover.Trigger data-testid="popover-trigger">Popover</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup data-testid="popover-popup">
          <Menu.Root v-bind="root">
            <Menu.Trigger data-testid="trigger">Menu</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner data-testid="positioner">
                <Menu.Popup data-testid="popup">
                  <Menu.Item data-key="a">a</Menu.Item>
                  <Popover.Root v-bind="inner">
                    <Popover.Trigger data-testid="inner-trigger">Info</Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Positioner>
                        <Popover.Popup data-testid="inner-popup">
                          <button data-testid="inner-button">Inside</button>
                        </Popover.Popup>
                      </Popover.Positioner>
                    </Popover.Portal>
                  </Popover.Root>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
