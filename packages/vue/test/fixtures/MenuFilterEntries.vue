<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';
import type { MenuEntry } from './menuEntries';

// The entries of a menu, or, with `submenu`, the root of one submenu entry with its parts.
defineProps({
  entries: { type: Array as PropType<MenuEntry[]>, default: () => [] },
  submenu: Object as PropType<MenuEntry>,
});
</script>

<template>
  <Menu.SubmenuRoot v-if="submenu" v-bind="submenu.root">
    <Menu.SubmenuTrigger :data-key="submenu.key" v-bind="submenu.trigger">
      {{ submenu.text ?? submenu.key }}
    </Menu.SubmenuTrigger>
    <Menu.Portal v-bind="submenu.portal">
      <Menu.Positioner :data-testid="`${submenu.key}-positioner`" v-bind="submenu.positioner">
        <Menu.Popup :data-testid="`${submenu.key}-popup`" v-bind="submenu.popup">
          <Menu.Input
            v-if="submenu.input !== false && (submenu.filter || submenu.input)"
            :data-testid="`${submenu.key}-input`"
            :aria-label="`Filter ${submenu.key}`"
            v-bind="submenu.input"
          />
          <Menu.List
            v-if="submenu.list !== false && (submenu.filter || submenu.list)"
            :data-testid="`${submenu.key}-list`"
            v-bind="submenu.list"
          >
            <MenuFilterEntries :entries="submenu.items" />
          </Menu.List>
          <MenuFilterEntries v-else :entries="submenu.items" />
          <Menu.Empty v-if="submenu.empty !== undefined" :data-testid="`${submenu.key}-empty`">
            {{ submenu.empty }}
          </Menu.Empty>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.SubmenuRoot>
  <template v-else>
    <template v-for="entry in entries" :key="entry.key">
      <Menu.CheckboxItem
        v-if="entry.kind === 'checkbox'"
        :data-key="entry.key"
        v-bind="entry.attrs"
      >
        {{ entry.text ?? entry.key }}
      </Menu.CheckboxItem>
      <Menu.RadioItem
        v-else-if="entry.kind === 'radio'"
        :data-key="entry.key"
        :value="entry.key"
        v-bind="entry.attrs"
      >
        {{ entry.text ?? entry.key }}
      </Menu.RadioItem>
      <Menu.LinkItem
        v-else-if="entry.kind === 'link'"
        :data-key="entry.key"
        :href="`#${entry.key}`"
        v-bind="entry.attrs"
      >
        {{ entry.text ?? entry.key }}
      </Menu.LinkItem>
      <button v-else-if="entry.kind === 'button'" :data-key="entry.key" v-bind="entry.attrs">
        {{ entry.text ?? entry.key }}
      </button>
      <Menu.Group v-else-if="entry.kind === 'group'" :data-testid="entry.key" v-bind="entry.attrs">
        <Menu.GroupLabel v-if="entry.label">{{ entry.label }}</Menu.GroupLabel>
        <MenuFilterEntries :entries="entry.items" />
      </Menu.Group>
      <Menu.RadioGroup
        v-else-if="entry.kind === 'radio-group'"
        :data-testid="entry.key"
        v-bind="entry.attrs"
      >
        <MenuFilterEntries :entries="entry.items" />
      </Menu.RadioGroup>
      <template v-else-if="entry.kind === 'submenu'">
        <Menu.FilterProvider v-if="entry.filter" v-bind="entry.filter">
          <MenuFilterEntries :submenu="entry" />
        </Menu.FilterProvider>
        <MenuFilterEntries v-else :submenu="entry" />
      </template>
      <Menu.Item v-else :data-key="entry.key" v-bind="entry.attrs">
        {{ entry.text ?? entry.key }}
      </Menu.Item>
    </template>
  </template>
</template>
