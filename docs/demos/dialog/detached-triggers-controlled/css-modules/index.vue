<script setup lang="ts">
import { shallowRef } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';
import styles from '../../_index.module.css';

const demoDialog = Dialog.createHandle<number>();

const open = shallowRef(false);
const triggerId = shallowRef<string | null>(null);

function handleOpenChange(isOpen: boolean, eventDetails: Dialog.Root.ChangeEventDetails) {
  open.value = isOpen;
  triggerId.value = eventDetails.trigger?.id ?? null;
}

function openProgrammatically() {
  triggerId.value = 'trigger-2';
  open.value = true;
}
</script>

<template>
  <div :class="styles.Container">
    <Dialog.Trigger id="trigger-1" :class="styles.Button" :handle="demoDialog" :payload="1">
      Open 1
    </Dialog.Trigger>

    <Dialog.Trigger id="trigger-2" :class="styles.Button" :handle="demoDialog" :payload="2">
      Open 2
    </Dialog.Trigger>

    <Dialog.Trigger id="trigger-3" :class="styles.Button" :handle="demoDialog" :payload="3">
      Open 3
    </Dialog.Trigger>

    <button :class="styles.Button" type="button" @click="openProgrammatically">
      Open programmatically
    </button>
  </div>

  <Dialog.Root
    :handle="demoDialog"
    :open="open"
    :trigger-id="triggerId"
    @open-change="handleOpenChange"
  >
    <template #default="{ payload }">
      <Dialog.Portal>
        <Dialog.Backdrop :class="styles.Backdrop" />
        <Dialog.Popup :class="styles.Popup">
          <Dialog.Title v-if="payload !== undefined" :class="styles.Title">
            Dialog {{ payload }}
          </Dialog.Title>
          <div :class="styles.Actions">
            <Dialog.Close :class="styles.Button">Close</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </template>
  </Dialog.Root>
</template>
