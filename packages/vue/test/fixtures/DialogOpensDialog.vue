<script setup lang="ts">
import { shallowRef, type PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import { Popover } from '../../src/popover';

type Mode =
  'chain' | 'unmount-on-close' | 'mount-from-dialog' | 'mount-from-popover' | 'in-place-popover';

defineProps({
  mode: { type: String as PropType<Mode>, default: 'chain' },
});
const first = shallowRef(false);
const middle = shallowRef(false);
const second = shallowRef(false);

function next() {
  first.value = false;
  second.value = true;
}

function nextFromPopover() {
  middle.value = false;
  second.value = true;
}

function onSecondChange(open: boolean) {
  if (!open) second.value = false;
}
</script>

<template>
  <template v-if="mode === 'unmount-on-close'">
    <button data-testid="opener" @click="second = true">Open</button>
    <Dialog.Root v-if="second" default-open @open-change="onSecondChange">
      <Dialog.Portal>
        <Dialog.Popup data-testid="second-popup" style="position: fixed; left: 200px; top: 40px">
          <Dialog.Close data-testid="close">Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </template>

  <template v-else-if="mode === 'mount-from-popover'">
    <Popover.Root v-model:open="first">
      <Popover.Trigger data-testid="first-trigger">Open</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup data-testid="first-popup">
            <button data-testid="next" @click="next">Next</button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
    <Dialog.Root v-if="second" default-open @open-change="onSecondChange">
      <Dialog.Portal>
        <Dialog.Popup data-testid="second-popup" style="position: fixed; left: 200px; top: 40px">
          <Dialog.Close data-testid="close">Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </template>

  <template v-else-if="mode === 'in-place-popover'">
    <Dialog.Root v-model:open="first">
      <Dialog.Trigger data-testid="first-trigger">Open</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Popup data-testid="first-popup" style="position: fixed; left: 40px; top: 40px">
          <Popover.Root v-model:open="middle">
            <Popover.Trigger data-testid="popover-trigger">Popover</Popover.Trigger>
            <Popover.Portal disabled>
              <Popover.Positioner>
                <Popover.Popup data-testid="popover-popup">
                  <button data-testid="next" @click="nextFromPopover">Next</button>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <Dialog.Root v-model:open="second">
      <Dialog.Portal>
        <Dialog.Popup data-testid="second-popup" style="position: fixed; left: 200px; top: 40px">
          <Dialog.Close data-testid="close">Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </template>

  <template v-else>
    <Dialog.Root v-model:open="first">
      <Dialog.Trigger data-testid="first-trigger">Open</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Popup data-testid="first-popup" style="position: fixed; left: 40px; top: 40px">
          <button data-testid="next" @click="next">Next</button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <Dialog.Root
      v-if="mode === 'mount-from-dialog' && second"
      default-open
      @open-change="onSecondChange"
    >
      <Dialog.Portal>
        <Dialog.Popup data-testid="second-popup" style="position: fixed; left: 200px; top: 40px">
          <Dialog.Close data-testid="close">Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <Dialog.Root v-else-if="mode === 'chain'" v-model:open="second">
      <Dialog.Portal>
        <Dialog.Popup data-testid="second-popup" style="position: fixed; left: 200px; top: 40px">
          <Dialog.Close data-testid="close">Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </template>
</template>
