<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import { Menu } from '../../src/menu';
import { Popover } from '../../src/popover';
import { ScrollArea } from '../../src/scroll-area';

// An open dialog with buttons outside it, by `variant`:
// - `scroll-area`: a scroll area with no overflow in the popup of a `'trap-focus'` dialog.
// - `display-contents`: the popup of a `'trap-focus'` dialog in a form with `display: contents`.
// - `menu`: a closed dialog that an item of a menu opens.
// - `popover`: a closed dialog that a button in the popup of a popover opens, and the popover
//   closes.
defineProps({
  variant: {
    type: String as PropType<'scroll-area' | 'display-contents' | 'menu' | 'popover'>,
    required: true,
  },
  scene: {
    type: Object as PropType<{ open: boolean; popover?: boolean }>,
    default: () => ({ open: false }),
  },
});
</script>

<template>
  <button data-testid="before">Before</button>
  <Dialog.Root v-if="variant === 'scroll-area'" default-open modal="trap-focus">
    <Dialog.Portal>
      <Dialog.Popup data-testid="popup">
        <ScrollArea.Root style="width: 200px; height: 200px">
          <ScrollArea.Viewport style="width: 100%; height: 100%">
            <div style="width: 100px; height: 100px">Content</div>
          </ScrollArea.Viewport>
        </ScrollArea.Root>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
  <Dialog.Root v-else-if="variant === 'display-contents'" default-open modal="trap-focus">
    <Dialog.Portal>
      <form style="display: contents">
        <Dialog.Popup data-testid="popup">
          <input data-testid="first" aria-label="First" />
          <button type="button" data-testid="second">Second</button>
        </Dialog.Popup>
      </form>
    </Dialog.Portal>
  </Dialog.Root>
  <template v-else-if="variant === 'popover'">
    <Popover.Root v-model:open="scene.popover">
      <Popover.Trigger data-testid="menu-trigger">Popover</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup>
            <button
              @click="
                scene.popover = false;
                scene.open = true;
              "
            >
              Open dialog
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  </template>
  <template v-else>
    <Menu.Root>
      <Menu.Trigger data-testid="menu-trigger">Menu</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.Item @click="scene.open = true">Open dialog</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </template>
  <Dialog.Root v-if="variant === 'menu' || variant === 'popover'" v-model:open="scene.open">
    <Dialog.Portal>
      <Dialog.Popup data-testid="popup">
        <Dialog.Close>Close</Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
  <button data-testid="after">After</button>
</template>
