<script setup lang="ts">
import { shallowRef } from 'vue';
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import styles from '../../_index.module.css';

type AlertPayload = { message: string };

const demoAlertDialog = AlertDialog.createHandle<AlertPayload>();

const open = shallowRef(false);
const triggerId = shallowRef<string | null>(null);

function handleOpenChange(isOpen: boolean, eventDetails: AlertDialog.Root.ChangeEventDetails) {
  open.value = isOpen;
  triggerId.value = eventDetails.trigger?.id ?? null;
}

function openProgrammatically() {
  triggerId.value = 'alert-trigger-2';
  open.value = true;
}
</script>

<template>
  <div :class="styles.Container">
    <AlertDialog.Trigger
      :class="[styles.Button, styles.DangerButton]"
      :handle="demoAlertDialog"
      id="alert-trigger-1"
      :payload="{ message: 'Discard draft?' }"
    >
      Discard
    </AlertDialog.Trigger>

    <AlertDialog.Trigger
      :class="[styles.Button, styles.DangerButton]"
      :handle="demoAlertDialog"
      id="alert-trigger-2"
      :payload="{ message: 'Delete project?' }"
    >
      Delete
    </AlertDialog.Trigger>

    <AlertDialog.Trigger
      :class="styles.Button"
      :handle="demoAlertDialog"
      id="alert-trigger-3"
      :payload="{ message: 'Sign out?' }"
    >
      Sign out
    </AlertDialog.Trigger>

    <button :class="styles.Button" type="button" @click="openProgrammatically">
      Open programmatically
    </button>
  </div>

  <AlertDialog.Root
    :handle="demoAlertDialog"
    :open="open"
    :trigger-id="triggerId"
    @open-change="handleOpenChange"
  >
    <template #default="{ payload }">
      <AlertDialog.Portal>
        <AlertDialog.Backdrop :class="styles.Backdrop" />
        <AlertDialog.Popup :class="styles.Popup">
          <div :class="styles.Intro">
            <AlertDialog.Title :class="styles.Title">
              {{ payload?.message ?? 'Are you sure?' }}
            </AlertDialog.Title>
            <AlertDialog.Description :class="styles.Description">
              This action cannot be undone.
            </AlertDialog.Description>
          </div>
          <div :class="styles.Actions">
            <AlertDialog.Close :class="styles.Button">Cancel</AlertDialog.Close>
            <AlertDialog.Close :class="[styles.Button, styles.DangerButton]">
              Confirm
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </template>
  </AlertDialog.Root>
</template>
