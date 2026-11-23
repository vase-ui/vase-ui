<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import { Menu } from '../../src/menu';
import { Popover } from '../../src/popover';
import { Tooltip } from '../../src/tooltip';
import PartTransition from './PartTransition.vue';

// The backdrop and the popup of one family, open while `scene.open`. Each part is in a
// `<PartTransition>`. With `inSlot`, each part renders a `<section>` in its `element` slot and has no
// `<Transition>`. Tooltip has no backdrop.
defineProps({
  family: { type: String as PropType<'dialog' | 'popover' | 'menu' | 'tooltip'>, required: true },
  scene: { type: Object as PropType<{ open: boolean }>, required: true },
  inSlot: Boolean,
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
});
</script>

<template>
  <Dialog.Root v-if="family === 'dialog'" :open="scene.open">
    <Dialog.Portal>
      <PartTransition :on="!inSlot" name="backdrop" :log>
        <Dialog.Backdrop data-testid="backdrop">
          <template v-if="inSlot" #element="{ props, elementRef }">
            <section v-bind="props" :ref="elementRef" />
          </template>
        </Dialog.Backdrop>
      </PartTransition>
      <PartTransition :on="!inSlot" name="popup" :log>
        <Dialog.Popup data-testid="popup">
          <template v-if="inSlot" #element="{ props, elementRef }">
            <section v-bind="props" :ref="elementRef" />
          </template>
          Dialog
        </Dialog.Popup>
      </PartTransition>
    </Dialog.Portal>
  </Dialog.Root>
  <Popover.Root v-else-if="family === 'popover'" :open="scene.open">
    <Popover.Portal>
      <PartTransition :on="!inSlot" name="backdrop" :log>
        <Popover.Backdrop data-testid="backdrop">
          <template v-if="inSlot" #element="{ props, elementRef }">
            <section v-bind="props" :ref="elementRef" />
          </template>
        </Popover.Backdrop>
      </PartTransition>
      <Popover.Positioner>
        <PartTransition :on="!inSlot" name="popup" :log>
          <Popover.Popup data-testid="popup">
            <template v-if="inSlot" #element="{ props, elementRef }">
              <section v-bind="props" :ref="elementRef" />
            </template>
            Popover
          </Popover.Popup>
        </PartTransition>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
  <Menu.Root v-else-if="family === 'menu'" :open="scene.open">
    <Menu.Portal>
      <PartTransition :on="!inSlot" name="backdrop" :log>
        <Menu.Backdrop data-testid="backdrop">
          <template v-if="inSlot" #element="{ props, elementRef }">
            <section v-bind="props" :ref="elementRef" />
          </template>
        </Menu.Backdrop>
      </PartTransition>
      <Menu.Positioner>
        <PartTransition :on="!inSlot" name="popup" :log>
          <Menu.Popup data-testid="popup">
            <template v-if="inSlot" #element="{ props, elementRef }">
              <section v-bind="props" :ref="elementRef" />
            </template>
            <Menu.Item>Item</Menu.Item>
          </Menu.Popup>
        </PartTransition>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
  <Tooltip.Root v-else :open="scene.open">
    <Tooltip.Portal>
      <Tooltip.Positioner>
        <PartTransition :on="!inSlot" name="popup" :log>
          <Tooltip.Popup data-testid="popup">
            <template v-if="inSlot" #element="{ props, elementRef }">
              <section v-bind="props" :ref="elementRef" />
            </template>
            Tooltip
          </Tooltip.Popup>
        </PartTransition>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
</template>
