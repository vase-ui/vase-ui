<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';

type Props = Record<string, unknown>;

// A filterable menu: a group of fruit, a vegetable, a radio group of citrus when `radio` is set, and
// a link when `link` is set, and a submenu when `submenu` is set. With `filterSubmenu`, the submenu
// has a filter and an input of its own. `texts` replaces the text of an item by its key.
defineProps({
  provider: Object as PropType<Props>,
  root: Object as PropType<Props>,
  trigger: Object as PropType<Props>,
  input: Object as PropType<Props>,
  list: Object as PropType<Props>,
  clear: Boolean,
  radio: Boolean,
  link: Boolean,
  submenu: Boolean,
  filterSubmenu: Boolean,
  submenuPortal: Object as PropType<Props>,
  texts: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
  /** The parts that a test removes while the menu is open: `input`. */
  shown: { type: Object as PropType<Record<string, boolean>>, default: () => ({}) },
});
</script>

<template>
  <input id="before" aria-label="Before" />
  <Menu.FilterProvider v-bind="provider">
    <Menu.Root v-bind="root">
      <Menu.Trigger data-testid="trigger" v-bind="trigger">Menu</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner data-testid="positioner">
          <Menu.Popup data-testid="popup">
            <Menu.Input
              v-if="shown.input !== false"
              data-testid="input"
              aria-label="Filter"
              v-bind="input"
            />
            <Menu.Clear data-testid="clear">Clear</Menu.Clear>
            <Menu.List data-testid="list" v-bind="list">
              <Menu.Group data-testid="fruit">
                <Menu.GroupLabel>Fruit</Menu.GroupLabel>
                <Menu.Item data-key="apple">{{ texts.apple ?? 'Apple' }}</Menu.Item>
                <Menu.Item data-key="apricot">{{ texts.apricot ?? 'Apricot' }}</Menu.Item>
                <Menu.Item data-key="banana">{{ texts.banana ?? 'Banana' }}</Menu.Item>
              </Menu.Group>
              <Menu.Item data-key="carrot" label="Carrot">Orange root</Menu.Item>
              <Menu.RadioGroup v-if="radio" data-testid="citrus">
                <Menu.RadioItem data-key="lemon" value="lemon">Lemon</Menu.RadioItem>
                <Menu.RadioItem data-key="lime" value="lime">Lime</Menu.RadioItem>
              </Menu.RadioGroup>
              <Menu.LinkItem v-if="link" data-key="link" href="#filter-link">Link</Menu.LinkItem>
              <Menu.SubmenuRoot v-if="submenu">
                <Menu.SubmenuTrigger data-key="more" :delay="0">More</Menu.SubmenuTrigger>
                <Menu.Portal v-bind="submenuPortal">
                  <Menu.Positioner>
                    <Menu.Popup data-testid="sub-popup">
                      <Menu.Item data-key="cherry">Cherry</Menu.Item>
                      <Menu.Item data-key="date">Date</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
              <Menu.FilterProvider v-if="filterSubmenu">
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger data-key="more" :delay="0">More</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="sub-popup">
                        <Menu.Input data-testid="sub-input" aria-label="Filter more" />
                        <Menu.List>
                          <Menu.Item data-key="cherry">Cherry</Menu.Item>
                        </Menu.List>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.FilterProvider>
            </Menu.List>
            <Menu.Empty data-testid="empty">No match</Menu.Empty>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </Menu.FilterProvider>
  <input id="after" aria-label="After" style="position: fixed; right: 0; bottom: 30px" />
</template>
