<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import { Popover } from '../../src/popover';

type Props = Record<string, unknown>;

// A popover and a dialog together, by `variant`:
// - `dialog-in-popover`: an open dialog in the popup of an open popover.
// - `popover-in-dialog`: an open modal popover with a backdrop in the popup of an open dialog.
// - `dialog-after`: an open popover whose popup holds a trigger of a dialog outside its tree.
// - `dialog-before`: an open dialog whose popup holds a trigger of a popover outside its tree.
defineProps({
  variant: {
    type: String as PropType<
      'dialog-in-popover' | 'popover-in-dialog' | 'dialog-after' | 'dialog-before'
    >,
    required: true,
  },
  popover: Object as PropType<Props>,
  dialog: Object as PropType<Props>,
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => new Set() },
});
const popoverHandle = Popover.createHandle();
const dialogHandle = Dialog.createHandle();
</script>

<template>
  <Popover.Root
    v-if="variant === 'dialog-in-popover'"
    default-open
    v-bind="popover"
    @open-change="(open: boolean, details) => log.add(`popover ${open} ${details.reason}`)"
  >
    <Popover.Trigger>Popover</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup data-testid="popover" :initial-focus="false">
          <Dialog.Root
            v-bind="dialog"
            @open-change="(open: boolean, details) => log.add(`dialog ${open} ${details.reason}`)"
          >
            <Dialog.Trigger>Open dialog</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Backdrop data-testid="backdrop" style="position: fixed; inset: 0" />
              <Dialog.Popup data-testid="dialog" style="position: fixed; left: 40%; top: 40%">
                <input data-testid="input" aria-label="Input" />
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
  <Dialog.Root
    v-else-if="variant === 'popover-in-dialog'"
    default-open
    v-bind="dialog"
    @open-change="(open: boolean, details) => log.add(`dialog ${open} ${details.reason}`)"
  >
    <Dialog.Portal>
      <Dialog.Popup data-testid="dialog" style="position: fixed; left: 300px; top: 0">
        <Popover.Root
          default-open
          modal
          v-bind="popover"
          @open-change="(open: boolean, details) => log.add(`popover ${open} ${details.reason}`)"
        >
          <Popover.Trigger>Popover</Popover.Trigger>
          <Popover.Portal>
            <Popover.Backdrop data-testid="backdrop" style="position: fixed; inset: 0" />
            <Popover.Positioner>
              <Popover.Popup data-testid="popover" :initial-focus="false">Popover</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
  <template v-else-if="variant === 'dialog-after'">
    <Popover.Root
      default-open
      @open-change="(open: boolean, details) => log.add(`popover ${open} ${details.reason}`)"
    >
      <Popover.Trigger>Popover</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup data-testid="popover">
            <Dialog.Trigger :handle="dialogHandle">Open dialog</Dialog.Trigger>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
    <Dialog.Root :handle="dialogHandle">
      <Dialog.Portal>
        <Dialog.Popup data-testid="dialog" style="position: fixed; left: 300px; top: 200px">
          <form @submit.prevent="log.add('submit')">
            <input data-testid="input" aria-label="Input" />
            <button type="submit">Submit</button>
          </form>
          <button type="button">Inside dialog</button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </template>
  <template v-else>
    <Dialog.Root default-open>
      <Dialog.Portal>
        <Dialog.Popup data-testid="dialog" style="position: fixed; left: 300px; top: 200px">
          <button type="button" @mousedown.prevent>Inside dialog</button>
          <Popover.Trigger :handle="popoverHandle">Open popover</Popover.Trigger>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <Popover.Root
      :handle="popoverHandle"
      @open-change="(open: boolean, details) => log.add(`popover ${open} ${details.reason}`)"
    >
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup data-testid="popover">Popover</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  </template>
</template>
