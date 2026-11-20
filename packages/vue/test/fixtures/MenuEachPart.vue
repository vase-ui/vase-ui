<script setup lang="ts">
import { shallowReactive } from 'vue';
import { Menu } from '../../src/menu';

// Two open menus with each part that renders an element: a plain menu and a filterable menu. Each
// part has the class `part`, and `refs` has the template ref of each part by its name.
const refs = shallowReactive<Record<string, { element?: Element | null } | null>>({});
const setRef = (name: string) => (value: unknown) => {
  refs[name] = value as { element?: Element | null } | null;
};
defineExpose({ refs });
</script>

<template>
  <Menu.Root default-open>
    <Menu.Trigger :ref="setRef('Trigger')" class="part">Menu</Menu.Trigger>
    <Menu.Portal>
      <Menu.Backdrop :ref="setRef('Backdrop')" class="part" />
      <Menu.Positioner :ref="setRef('Positioner')" class="part">
        <Menu.Popup :ref="setRef('Popup')" class="part">
          <Menu.Arrow :ref="setRef('Arrow')" class="part" />
          <Menu.Viewport :ref="setRef('Viewport')" class="part">
            <Menu.List :ref="setRef('List')" class="part">
              <Menu.Item :ref="setRef('Item')" class="part">Item</Menu.Item>
              <Menu.LinkItem :ref="setRef('LinkItem')" class="part" href="#link"
                >Link</Menu.LinkItem
              >
              <Menu.CheckboxItem :ref="setRef('CheckboxItem')" class="part"
                >Check</Menu.CheckboxItem
              >
              <Menu.RadioGroup :ref="setRef('RadioGroup')" class="part">
                <Menu.RadioItem :ref="setRef('RadioItem')" class="part" value="a">A</Menu.RadioItem>
              </Menu.RadioGroup>
              <Menu.Group :ref="setRef('Group')" class="part">
                <Menu.GroupLabel :ref="setRef('GroupLabel')" class="part">Group</Menu.GroupLabel>
              </Menu.Group>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger :ref="setRef('SubmenuTrigger')" class="part">
                  More
                </Menu.SubmenuTrigger>
              </Menu.SubmenuRoot>
            </Menu.List>
          </Menu.Viewport>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
  <Menu.FilterProvider default-value="zz">
    <Menu.Root default-open>
      <Menu.Trigger>Filter</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.Input :ref="setRef('Input')" class="part" aria-label="Filter" />
            <Menu.Clear :ref="setRef('Clear')" class="part">Clear</Menu.Clear>
            <Menu.List>
              <Menu.Item>Apple</Menu.Item>
            </Menu.List>
            <Menu.Empty :ref="setRef('Empty')" class="part">No match</Menu.Empty>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </Menu.FilterProvider>
</template>
