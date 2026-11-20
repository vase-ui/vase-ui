<script setup lang="ts">
import { reactive, type PropType } from 'vue';
import { AlertDialog } from '../../src/alert-dialog';
import { Dialog } from '../../src/dialog';

type Props = Record<string, unknown>;
type Sibling = {
  alert?: boolean;
  root?: Props;
  trigger?: false;
  portal?: Props;
  backdrop?: Props;
  viewport?: Props;
  popup?: Props;
};

// Dialogs side by side, none in another. The trigger of dialog `n`, unless `trigger` is `false`, has
// the `data-key` `n`, and its
// popup the `data-testid` `popup-n`, with a button that opens the next dialog. Each popup is fixed
// at the top left, a little lower than the one before, so a press on a lower popup goes to the
// fixed element of a modal dialog above it.
defineProps({
  dialogs: { type: Array as PropType<Sibling[]>, required: true },
  /** The open state of each dialog. `set` writes it. */
  scene: {
    type: Object as PropType<{
      open: Record<number, boolean>;
      set(index: number, open: boolean): void;
    }>,
    default: () => {
      const open = reactive<Record<number, boolean>>({});
      return { open, set: (index: number, value: boolean) => (open[index] = value) };
    },
  },
});
</script>

<template>
  <component
    :is="dialog.alert ? AlertDialog.Root : Dialog.Root"
    v-for="(dialog, index) in dialogs"
    :key="index"
    :open="scene.open[index]"
    v-bind="dialog.root"
    @update:open="(open: boolean) => scene.set(index, open)"
  >
    <component
      :is="dialog.alert ? AlertDialog.Trigger : Dialog.Trigger"
      v-if="dialog.trigger !== false"
      :data-key="index"
    >
      {{ index }}
    </component>
    <Dialog.Portal v-bind="dialog.portal">
      <Dialog.Backdrop
        v-if="dialog.backdrop"
        :data-testid="`backdrop-${index}`"
        v-bind="dialog.backdrop"
      />
      <Dialog.Viewport
        v-if="dialog.viewport"
        :data-testid="`viewport-${index}`"
        v-bind="dialog.viewport"
      >
        <Dialog.Popup
          :data-testid="`popup-${index}`"
          :style="`position: fixed; left: 0; top: ${index * 40}px`"
          v-bind="dialog.popup"
        >
          <button :data-testid="`next-${index}`" @click="scene.set(index + 1, true)">Next</button>
        </Dialog.Popup>
      </Dialog.Viewport>
      <Dialog.Popup
        v-else
        :data-testid="`popup-${index}`"
        :style="`position: fixed; left: 0; top: ${index * 40}px`"
        v-bind="dialog.popup"
      >
        <button :data-testid="`next-${index}`" @click="scene.set(index + 1, true)">Next</button>
      </Dialog.Popup>
    </Dialog.Portal>
  </component>
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
