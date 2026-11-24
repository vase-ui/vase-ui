<script setup lang="ts">
import { computed, ref, useTemplateRef, type PropType } from 'vue';
import { AlertDialog } from '../../src/alert-dialog';
import { Combobox } from '../../src/combobox';
import { Dialog } from '../../src/dialog';
import { Drawer } from '../../src/drawer';
import { Menu } from '../../src/menu';
import { Popover } from '../../src/popover';

type Family =
  'dialog' | 'dialog-uncontrolled' | 'alert-dialog' | 'drawer' | 'popover' | 'menu' | 'combobox';

// A popup that `opener` opens, and that the parent holds with `v-model:open`. The dialog of
// `dialog-uncontrolled` holds its own open state, and its trigger is `opener`. The `decide` item of
// each popup changes the page and closes the popup in one handler, so that Vue patches the page in
// the update of the close. The page has the button `target`, which Vue replaces with a new element
// in that update, the heading `fallback`, and the box `box` with two tab stops. `finalFocus` of the
// popup is a function that gives what `give` names: `target`, the `box`, or `false` after a focus
// of `fallback` by the function itself. A popover is modal only with `modal`.
const props = defineProps({
  family: { type: String as PropType<Family>, required: true },
  give: { type: String as PropType<'target' | 'box' | 'fallback'>, required: true },
  modal: Boolean,
});
const open = ref(false);
const generation = ref(0);
const target = useTemplateRef<HTMLElement>('target');
const box = useTemplateRef<HTMLElement>('box');
const fallback = useTemplateRef<HTMLElement>('fallback');

function decide() {
  generation.value += 1;
  open.value = false;
}

const finalFocus = computed(() => {
  if (props.give === 'target') return () => target.value;
  if (props.give === 'box') return () => box.value;
  return () => {
    fallback.value?.focus();
    return false;
  };
});
</script>

<template>
  <button v-if="family !== 'dialog-uncontrolled'" data-testid="opener" @click="open = true">
    Open
  </button>
  <h2 ref="fallback" data-testid="fallback" tabindex="-1">Fallback</h2>
  <button :key="generation" ref="target" data-testid="target">Target {{ generation }}</button>
  <div ref="box" data-testid="box">
    <button data-testid="box-1">One</button>
    <button data-testid="box-2">Two</button>
  </div>

  <Dialog.Root v-if="family === 'dialog'" v-model:open="open">
    <Dialog.Portal>
      <Dialog.Backdrop style="position: fixed; inset: 0" />
      <Dialog.Popup
        data-testid="popup"
        style="position: fixed; left: 200px; top: 100px"
        :final-focus="finalFocus"
      >
        <Dialog.Close data-testid="decide" @click="decide">Decide</Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>

  <Dialog.Root v-else-if="family === 'dialog-uncontrolled'">
    <Dialog.Trigger data-testid="opener">Open</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop style="position: fixed; inset: 0" />
      <Dialog.Popup
        data-testid="popup"
        style="position: fixed; left: 200px; top: 100px"
        :final-focus="finalFocus"
      >
        <Dialog.Close data-testid="decide" @click="decide">Decide</Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>

  <AlertDialog.Root v-else-if="family === 'alert-dialog'" v-model:open="open">
    <AlertDialog.Portal>
      <AlertDialog.Backdrop style="position: fixed; inset: 0" />
      <AlertDialog.Popup
        data-testid="popup"
        style="position: fixed; left: 200px; top: 100px"
        :final-focus="finalFocus"
      >
        <AlertDialog.Close data-testid="decide" @click="decide">Decide</AlertDialog.Close>
      </AlertDialog.Popup>
    </AlertDialog.Portal>
  </AlertDialog.Root>

  <Drawer.Root v-else-if="family === 'drawer'" v-model:open="open">
    <Drawer.Portal>
      <Drawer.Backdrop style="position: fixed; inset: 0" />
      <Drawer.Viewport>
        <Drawer.Popup
          data-testid="popup"
          style="position: fixed; left: 200px; top: 100px"
          :final-focus="finalFocus"
        >
          <Drawer.Close data-testid="decide" @click="decide">Decide</Drawer.Close>
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>

  <Popover.Root v-else-if="family === 'popover'" v-model:open="open" :modal="modal">
    <Popover.Trigger data-testid="trigger">Trigger</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup data-testid="popup" :final-focus="finalFocus">
          <Popover.Close data-testid="decide" @click="decide">Decide</Popover.Close>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>

  <Combobox.Root v-else-if="family === 'combobox'" v-model:open="open" :items="['One']">
    <Combobox.Input data-testid="trigger" />
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup data-testid="popup" :final-focus="finalFocus">
          <Combobox.List>
            <template #item="{ item }">
              <Combobox.Item :value="item" data-testid="decide" @click="decide">
                {{ item }}
              </Combobox.Item>
            </template>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>

  <Menu.Root v-else v-model:open="open">
    <Menu.Trigger data-testid="trigger">Trigger</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup data-testid="popup" :final-focus="finalFocus">
          <Menu.Item data-testid="decide" @click="decide">Decide</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
