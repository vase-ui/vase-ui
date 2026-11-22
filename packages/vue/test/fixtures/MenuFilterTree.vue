<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';
import MenuFilterEntries from './MenuFilterEntries.vue';
import type { MenuEntry } from './menuEntries';

type Props = Record<string, unknown>;

// A menu of the entries, in a `Menu.FilterProvider` unless `provider` is `false`. The popup has an
// input unless `input` is `false`, and the entries are in a `Menu.List` unless `list` is `false`.
// Text inputs stand before and after the root. `detached` is a second trigger after the root, for
// a `handle`. `wrapped` is for the instance in the provider.
defineProps({
  provider: { type: [Object, Boolean] as PropType<Props | false>, default: () => ({}) },
  root: Object as PropType<Props>,
  trigger: { type: [Object, Boolean] as PropType<Props | false>, default: () => ({}) },
  portal: Object as PropType<Props>,
  positioner: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  input: { type: [Object, Boolean] as PropType<Props | false>, default: () => ({}) },
  clear: Object as PropType<Props>,
  list: { type: [Object, Boolean] as PropType<Props | false>, default: () => ({}) },
  empty: { type: String, default: undefined },
  entries: { type: Array as PropType<MenuEntry[]>, default: () => [] },
  detached: Object as PropType<Props>,
  /** The popup leaves in a `<Transition>` of 10 s. */
  transition: Boolean,
  /** With `list` set to `false`, the entries are in a `Menu.Viewport`. */
  viewport: Boolean,
  /** The parts that a test removes while the menu is open: `input`. */
  shown: { type: Object as PropType<Record<string, boolean>>, default: () => ({}) },
  /** The key of the input: a new key renders a new input. */
  inputKey: { type: Object as PropType<{ key?: string }>, default: () => ({}) },
  wrapped: Boolean,
});
</script>

<template>
  <input v-if="!wrapped" id="before" aria-label="Before" />
  <Menu.FilterProvider v-if="!wrapped && provider !== false" v-bind="provider">
    <MenuFilterTree v-bind="$props" wrapped />
  </Menu.FilterProvider>
  <Menu.Root v-else v-bind="root">
    <Menu.Trigger v-if="trigger !== false" data-testid="trigger" v-bind="trigger">
      Actions
    </Menu.Trigger>
    <Menu.Portal v-bind="portal">
      <Menu.Positioner data-testid="positioner" v-bind="positioner">
        <Transition name="menu-filter-fade" :css="transition">
          <Menu.Popup data-testid="popup" v-bind="popup">
            <Menu.Input
              v-if="input !== false && shown.input !== false"
              :key="inputKey.key"
              data-testid="input"
              aria-label="Filter"
              v-bind="input"
            />
            <Menu.Clear v-if="clear" data-testid="clear" v-bind="clear">Clear</Menu.Clear>
            <Menu.List v-if="list !== false" data-testid="list" v-bind="list">
              <MenuFilterEntries :entries="entries" />
            </Menu.List>
            <Menu.Viewport v-else-if="viewport" data-testid="viewport">
              <MenuFilterEntries :entries="entries" />
            </Menu.Viewport>
            <MenuFilterEntries v-else :entries="entries" />
            <Menu.Empty v-if="empty !== undefined" data-testid="empty">{{ empty }}</Menu.Empty>
          </Menu.Popup>
        </Transition>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
  <Menu.Trigger v-if="!wrapped && detached" data-testid="detached" v-bind="detached">
    Other
  </Menu.Trigger>
  <input
    v-if="!wrapped"
    id="after"
    aria-label="After"
    style="position: fixed; right: 0; bottom: 30px"
  />
  <button v-if="!wrapped" id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>

<style>
.menu-filter-fade-leave-active {
  transition: opacity 10s linear;
}
.menu-filter-fade-leave-to {
  opacity: 0;
}
</style>
