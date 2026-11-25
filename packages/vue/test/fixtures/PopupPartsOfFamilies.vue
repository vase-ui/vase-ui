<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';
import { Dialog } from '../../src/dialog';
import { Menu } from '../../src/menu';
import { Popover } from '../../src/popover';
import { PreviewCard } from '../../src/preview-card';
import { Tooltip } from '../../src/tooltip';
import PartTransition from './PartTransition.vue';

// The backdrop and the popup of one family, open while `scene.open`. Each part is in a
// `<PartTransition>`. With `inSlot`, each part renders a `<section>` in its `element` slot and has no
// `<Transition>`. Tooltip has no backdrop. Each part has `as` and calls `count` with its name in its
// content.
defineProps({
  family: {
    type: String as PropType<
      'dialog' | 'popover' | 'menu' | 'tooltip' | 'preview-card' | 'combobox'
    >,
    required: true,
  },
  scene: { type: Object as PropType<{ open: boolean }>, required: true },
  inSlot: Boolean,
  keepMounted: Boolean,
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
  as: String as PropType<keyof HTMLElementTagNameMap>,
  count: { type: Function as PropType<(part: string) => string>, default: () => '' },
});
</script>

<template>
  <Dialog.Root v-if="family === 'dialog'" :open="scene.open">
    <Dialog.Portal :keep-mounted>
      <PartTransition :on="!inSlot" name="backdrop" :log>
        <Dialog.Backdrop data-testid="backdrop" :as>
          <template v-if="inSlot" #element="{ props, elementRef }">
            <section v-bind="props" :ref="elementRef" />
          </template>
          {{ count('backdrop') }}
        </Dialog.Backdrop>
      </PartTransition>
      <PartTransition :on="!inSlot" name="popup" :log>
        <Dialog.Popup data-testid="popup" :as>
          <template v-if="inSlot" #element="{ props, elementRef }">
            <section v-bind="props" :ref="elementRef" />
          </template>
          {{ count('popup') }}
          Dialog
        </Dialog.Popup>
      </PartTransition>
    </Dialog.Portal>
  </Dialog.Root>
  <Popover.Root v-else-if="family === 'popover'" :open="scene.open">
    <Popover.Portal :keep-mounted>
      <PartTransition :on="!inSlot" name="backdrop" :log>
        <Popover.Backdrop data-testid="backdrop" :as>
          <template v-if="inSlot" #element="{ props, elementRef }">
            <section v-bind="props" :ref="elementRef" />
          </template>
          {{ count('backdrop') }}
        </Popover.Backdrop>
      </PartTransition>
      <Popover.Positioner>
        <PartTransition :on="!inSlot" name="popup" :log>
          <Popover.Popup data-testid="popup" :as>
            <template v-if="inSlot" #element="{ props, elementRef }">
              <section v-bind="props" :ref="elementRef" />
            </template>
            {{ count('popup') }}
            Popover
          </Popover.Popup>
        </PartTransition>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
  <Menu.Root v-else-if="family === 'menu'" :open="scene.open">
    <Menu.Portal :keep-mounted>
      <PartTransition :on="!inSlot" name="backdrop" :log>
        <Menu.Backdrop data-testid="backdrop" :as>
          <template v-if="inSlot" #element="{ props, elementRef }">
            <section v-bind="props" :ref="elementRef" />
          </template>
          {{ count('backdrop') }}
        </Menu.Backdrop>
      </PartTransition>
      <Menu.Positioner>
        <PartTransition :on="!inSlot" name="popup" :log>
          <Menu.Popup data-testid="popup" :as>
            <template v-if="inSlot" #element="{ props, elementRef }">
              <section v-bind="props" :ref="elementRef" />
            </template>
            {{ count('popup') }}
            <Menu.Item>Item</Menu.Item>
          </Menu.Popup>
        </PartTransition>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
  <Tooltip.Root v-else-if="family === 'tooltip'" :open="scene.open">
    <Tooltip.Portal :keep-mounted>
      <Tooltip.Positioner>
        <PartTransition :on="!inSlot" name="popup" :log>
          <Tooltip.Popup data-testid="popup" :as>
            <template v-if="inSlot" #element="{ props, elementRef }">
              <section v-bind="props" :ref="elementRef" />
            </template>
            {{ count('popup') }}
            Tooltip
          </Tooltip.Popup>
        </PartTransition>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
  <PreviewCard.Root v-else-if="family === 'preview-card'" :open="scene.open">
    <PreviewCard.Portal :keep-mounted>
      <PartTransition :on="!inSlot" name="backdrop" :log>
        <PreviewCard.Backdrop data-testid="backdrop" :as>
          <template v-if="inSlot" #element="{ props, elementRef }">
            <section v-bind="props" :ref="elementRef" />
          </template>
          {{ count('backdrop') }}
        </PreviewCard.Backdrop>
      </PartTransition>
      <PreviewCard.Positioner>
        <PartTransition :on="!inSlot" name="popup" :log>
          <PreviewCard.Popup data-testid="popup" :as>
            <template v-if="inSlot" #element="{ props, elementRef }">
              <section v-bind="props" :ref="elementRef" />
            </template>
            {{ count('popup') }}
            PreviewCard
          </PreviewCard.Popup>
        </PartTransition>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  </PreviewCard.Root>
  <Combobox.Root v-else :open="scene.open" :items="['Item']">
    <Combobox.Portal :keep-mounted>
      <PartTransition :on="!inSlot" name="backdrop" :log>
        <Combobox.Backdrop data-testid="backdrop" :as>
          <template v-if="inSlot" #element="{ props, elementRef }">
            <section v-bind="props" :ref="elementRef" />
          </template>
          {{ count('backdrop') }}
        </Combobox.Backdrop>
      </PartTransition>
      <Combobox.Positioner>
        <PartTransition :on="!inSlot" name="popup" :log>
          <Combobox.Popup data-testid="popup" :as>
            <template v-if="inSlot" #element="{ props, elementRef }">
              <section v-bind="props" :ref="elementRef" />
            </template>
            {{ count('popup') }}
            <Combobox.List>
              <template #item="{ item }">
                <Combobox.Item :value="item">{{ item }}</Combobox.Item>
              </template>
            </Combobox.List>
          </Combobox.Popup>
        </PartTransition>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
