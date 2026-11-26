<script setup lang="ts">
import { computed, ref, type PropType } from 'vue';
import { Combobox } from '../../src/combobox';
import { Dialog } from '../../src/dialog';
import { Drawer } from '../../src/drawer';
import { Menu } from '../../src/menu';
import { NavigationMenu } from '../../src/navigation-menu';
import { Popover } from '../../src/popover';
import { PreviewCard } from '../../src/preview-card';
import { Select } from '../../src/select';
import { Tooltip } from '../../src/tooltip';
import PopupContentDirective from './PopupContentDirective.vue';
import PopupContentOnMounted from './PopupContentOnMounted.vue';
import type { PopupContentMode, PopupContentReading } from './popupContent';

const props = defineProps({
  family: {
    type: String as PropType<
      | 'dialog'
      | 'drawer'
      | 'popover'
      | 'menu'
      | 'tooltip'
      | 'preview-card'
      | 'combobox'
      | 'combobox-popup-input'
      | 'navigation-menu'
      | 'navigation-menu-content'
      | 'select'
      | 'select-anchored'
    >,
    required: true,
  },
  mode: { type: String as PropType<PopupContentMode>, required: true },
  defaultOpen: Boolean,
  disabledPortal: Boolean,
  selectValue: String,
  log: { type: Object as PropType<{ add(entry: PopupContentReading): void }>, required: true },
});
const open = ref(props.defaultOpen);
const content = computed(() =>
  props.mode === 'onMounted' ? PopupContentOnMounted : PopupContentDirective,
);
</script>

<template>
  <Dialog.Root v-if="family === 'dialog'" :default-open>
    <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
    <Dialog.Portal :disabled="disabledPortal">
      <Dialog.Popup data-testid="popup">
        <button type="button" data-testid="first">First</button>
        <component :is="content" :log />
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
  <Drawer.Root v-else-if="family === 'drawer'" :default-open>
    <Drawer.Trigger data-testid="trigger">Open</Drawer.Trigger>
    <Drawer.Portal :disabled="disabledPortal">
      <Drawer.Viewport>
        <Drawer.Popup data-testid="popup">
          <button type="button" data-testid="first">First</button>
          <component :is="content" :log />
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
  <Popover.Root v-else-if="family === 'popover'" :default-open>
    <Popover.Trigger data-testid="trigger">Open</Popover.Trigger>
    <Popover.Portal :disabled="disabledPortal">
      <Popover.Positioner data-testid="positioner">
        <Popover.Popup data-testid="popup">
          <button type="button" data-testid="first">First</button>
          <component :is="content" :log />
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
  <Menu.Root v-else-if="family === 'menu'" :default-open>
    <Menu.Trigger data-testid="trigger">Open</Menu.Trigger>
    <Menu.Portal :disabled="disabledPortal">
      <Menu.Positioner data-testid="positioner">
        <Menu.Popup data-testid="popup">
          <Menu.Item data-testid="item-1">Item 1</Menu.Item>
          <component :is="content" :log />
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
  <Tooltip.Root v-else-if="family === 'tooltip'" :default-open>
    <Tooltip.Trigger data-testid="trigger" :delay="0">Open</Tooltip.Trigger>
    <Tooltip.Portal :disabled="disabledPortal">
      <Tooltip.Positioner data-testid="positioner">
        <Tooltip.Popup data-testid="popup">
          <component :is="content" :log />
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
  <PreviewCard.Root v-else-if="family === 'preview-card'" :default-open>
    <PreviewCard.Trigger data-testid="trigger" href="#" :delay="0">Open</PreviewCard.Trigger>
    <PreviewCard.Portal :disabled="disabledPortal">
      <PreviewCard.Positioner data-testid="positioner">
        <PreviewCard.Popup data-testid="popup">
          <component :is="content" :log />
        </PreviewCard.Popup>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  </PreviewCard.Root>
  <Combobox.Root v-else-if="family === 'combobox'" :items="['Item']" :default-open>
    <Combobox.Input aria-label="Combobox" />
    <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
    <Combobox.Portal :disabled="disabledPortal">
      <Combobox.Positioner data-testid="positioner">
        <Combobox.Popup data-testid="popup">
          <component :is="content" :log />
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
  <Combobox.Root v-else-if="family === 'combobox-popup-input'" :items="['Item']" :default-open>
    <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
    <Combobox.Portal :disabled="disabledPortal">
      <Combobox.Positioner data-testid="positioner">
        <Combobox.Popup data-testid="popup">
          <Combobox.Input aria-label="Search" data-testid="first" />
          <component :is="content" :log />
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
  <NavigationMenu.Root v-else-if="family === 'navigation-menu'">
    <NavigationMenu.List>
      <NavigationMenu.Item value="one">
        <NavigationMenu.Trigger data-testid="trigger">One</NavigationMenu.Trigger>
        <NavigationMenu.Content>NavigationMenu</NavigationMenu.Content>
      </NavigationMenu.Item>
    </NavigationMenu.List>
    <NavigationMenu.Portal :disabled="disabledPortal">
      <NavigationMenu.Positioner data-testid="positioner">
        <NavigationMenu.Popup data-testid="popup">
          <component :is="content" :log />
          <NavigationMenu.Viewport />
        </NavigationMenu.Popup>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
  <NavigationMenu.Root v-else-if="family === 'navigation-menu-content'">
    <NavigationMenu.List>
      <NavigationMenu.Item value="one">
        <NavigationMenu.Trigger data-testid="trigger">One</NavigationMenu.Trigger>
        <NavigationMenu.Content>
          <component :is="content" :log />
        </NavigationMenu.Content>
      </NavigationMenu.Item>
    </NavigationMenu.List>
    <NavigationMenu.Portal :disabled="disabledPortal">
      <NavigationMenu.Positioner data-testid="positioner">
        <NavigationMenu.Popup data-testid="popup">
          <NavigationMenu.Viewport />
        </NavigationMenu.Popup>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
  <div v-else>
    <button type="button" data-testid="opener" @click="open = true">Programmatic</button>
    <Select.Root v-model:open="open" :default-value="selectValue">
      <Select.Trigger data-testid="trigger" style="margin-top: 200px">
        <Select.Value placeholder="Pick" />
      </Select.Trigger>
      <Select.Portal :disabled="disabledPortal">
        <Select.Positioner data-testid="positioner" :align-item-with-trigger="family === 'select'">
          <Select.Popup data-testid="popup">
            <component :is="content" :log />
            <Select.Item value="one" data-testid="item-one">
              <Select.ItemText>One</Select.ItemText>
            </Select.Item>
            <Select.Item value="two" data-testid="item-two">
              <Select.ItemText>Two</Select.ItemText>
            </Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  </div>
</template>
