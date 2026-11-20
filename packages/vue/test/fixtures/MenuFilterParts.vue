<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';

type Props = Record<string, unknown>;

// A filterable menu: a group of fruit, a vegetable, and a submenu when `submenu` is set. `texts`
// replaces the text of an item by its key.
defineProps({
  provider: Object as PropType<Props>,
  root: Object as PropType<Props>,
  input: Object as PropType<Props>,
  list: Object as PropType<Props>,
  clear: Boolean,
  submenu: Boolean,
  texts: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
});
</script>

<template>
  <input id="before" aria-label="Before" />
  <Menu.FilterProvider v-bind="provider">
    <Menu.Root v-bind="root">
      <Menu.Trigger data-testid="trigger">Menu</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner data-testid="positioner">
          <Menu.Popup data-testid="popup">
            <Menu.Input data-testid="input" aria-label="Filter" v-bind="input" />
            <Menu.Clear data-testid="clear">Clear</Menu.Clear>
            <Menu.List data-testid="list" v-bind="list">
              <Menu.Group data-testid="fruit">
                <Menu.GroupLabel>Fruit</Menu.GroupLabel>
                <Menu.Item data-key="apple">{{ texts.apple ?? 'Apple' }}</Menu.Item>
                <Menu.Item data-key="apricot">{{ texts.apricot ?? 'Apricot' }}</Menu.Item>
                <Menu.Item data-key="banana">{{ texts.banana ?? 'Banana' }}</Menu.Item>
              </Menu.Group>
              <Menu.Item data-key="carrot" label="Carrot">Orange root</Menu.Item>
              <Menu.SubmenuRoot v-if="submenu">
                <Menu.SubmenuTrigger data-key="more" :delay="0">More</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="sub-popup">
                      <Menu.Item data-key="cherry">Cherry</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.List>
            <Menu.Empty data-testid="empty">No match</Menu.Empty>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </Menu.FilterProvider>
  <input id="after" aria-label="After" style="position: fixed; right: 0; bottom: 30px" />
</template>
