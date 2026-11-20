<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import { Popover } from '../../src/popover';

// A dialog with popovers, by `variant`:
// - `triggers-in-popover`: a dialog that is not modal, with two triggers in the popup of an open
//   popover.
// - `popover-above`: an open dialog that is not modal with a nested dialog, and a popover beside
//   them, by `scene`.
// - `popover-before`: a popover that is open at the mount, and a dialog with no trigger, by
//   `scene`.
defineProps({
  variant: {
    type: String as PropType<'triggers-in-popover' | 'popover-above' | 'popover-before'>,
    required: true,
  },
  /** The open state of the nested dialog, the popover and the dialog. `set` writes it. */
  scene: {
    type: Object as PropType<{
      nested?: boolean;
      popover?: boolean;
      dialog?: boolean;
      set(key: 'nested' | 'popover' | 'dialog', open: boolean): void;
    }>,
    default: () => ({ set() {} }),
  },
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => new Set() },
});
const handle = Dialog.createHandle();
</script>

<template>
  <Popover.Root v-if="variant === 'triggers-in-popover'" default-open>
    <Popover.Trigger>Popover trigger</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup data-testid="popover">
          <Dialog.Root :handle :modal="false">
            <Dialog.Trigger :handle>Dialog trigger 1</Dialog.Trigger>
            <Dialog.Trigger :handle>Dialog trigger 2</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup data-testid="dialog" style="position: fixed; left: 300px; top: 300px">
                Dialog
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
  <template v-else-if="variant === 'popover-above'">
    <Dialog.Root
      default-open
      :modal="false"
      @open-change="(open: boolean, details) => log.add(`parent ${open} ${details.reason}`)"
    >
      <Dialog.Portal>
        <Dialog.Popup data-testid="parent" :initial-focus="false">
          <Dialog.Root
            :open="scene.nested"
            @update:open="scene.set('nested', $event)"
            :modal="false"
          >
            <Dialog.Portal>
              <Dialog.Popup data-testid="nested" :initial-focus="false">Nested</Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <Popover.Root
      :open="scene.popover"
      @update:open="scene.set('popover', $event)"
      @open-change="(open: boolean, details) => log.add(`popover ${open} ${details.reason}`)"
    >
      <Popover.Trigger>Popover</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup data-testid="popover" :initial-focus="false">Popover</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  </template>
  <template v-else>
    <Popover.Root default-open>
      <Popover.Trigger>Tip</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup>
            <Popover.Close>Got it</Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
    <Dialog.Root :open="scene.dialog" @update:open="scene.set('dialog', $event)">
      <Dialog.Portal>
        <Dialog.Popup data-testid="dialog">
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </template>
</template>
