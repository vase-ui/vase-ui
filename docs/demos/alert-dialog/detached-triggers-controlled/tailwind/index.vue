<script setup lang="ts">
import { shallowRef } from 'vue';
import { AlertDialog } from '@vase-ui/vue/alert-dialog';

const backdropHiddenClass = 'opacity-0';
const popupHiddenClass = 'scale-[0.98] opacity-0';

type AlertPayload = { message: string };

const demoAlertDialog = AlertDialog.createHandle<AlertPayload>();

const buttonClasses =
  'flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-disabled:bg-neutral-100 dark:hover:not-disabled:bg-neutral-800 active:not-disabled:bg-neutral-200 dark:active:not-disabled:bg-neutral-700 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white disabled:border-neutral-500 disabled:text-neutral-500 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400';

const dangerButtonClasses = `${buttonClasses} text-red-700 dark:text-red-400`;

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
  <div class="flex flex-wrap gap-2 justify-center">
    <AlertDialog.Trigger
      :class="dangerButtonClasses"
      :handle="demoAlertDialog"
      id="alert-trigger-1"
      :payload="{ message: 'Discard draft?' }"
    >
      Discard
    </AlertDialog.Trigger>

    <AlertDialog.Trigger
      :class="dangerButtonClasses"
      :handle="demoAlertDialog"
      id="alert-trigger-2"
      :payload="{ message: 'Delete project?' }"
    >
      Delete
    </AlertDialog.Trigger>

    <AlertDialog.Trigger
      :class="buttonClasses"
      :handle="demoAlertDialog"
      id="alert-trigger-3"
      :payload="{ message: 'Sign out?' }"
    >
      Sign out
    </AlertDialog.Trigger>

    <button :class="buttonClasses" type="button" @click="openProgrammatically">
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
        <Transition
          :enter-from-class="backdropHiddenClass"
          :leave-to-class="backdropHiddenClass"
          appear
        >
          <AlertDialog.Backdrop
            class="fixed inset-0 bg-black/20 dark:bg-black/50 transition-opacity duration-150 supports-[-webkit-touch-callout:none]:absolute supports-[-webkit-touch-callout:none]:min-h-dvh"
          />
        </Transition>
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass" appear>
          <AlertDialog.Popup
            class="fixed top-1/2 left-1/2 -mt-8 flex w-96 max-w-[calc(100%-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 bg-white dark:bg-neutral-950 p-4 text-neutral-950 dark:text-white border border-neutral-950 dark:border-white shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:shadow-none transition-[scale,opacity] duration-100 ease-out"
          >
            <div class="flex flex-col gap-1">
              <AlertDialog.Title class="text-base font-bold">
                {{ payload?.message ?? 'Are you sure?' }}
              </AlertDialog.Title>
              <AlertDialog.Description class="text-sm text-neutral-600 dark:text-neutral-400">
                This action cannot be undone.
              </AlertDialog.Description>
            </div>
            <div class="flex justify-end gap-3">
              <AlertDialog.Close :class="buttonClasses">Cancel</AlertDialog.Close>
              <AlertDialog.Close :class="dangerButtonClasses"> Confirm </AlertDialog.Close>
            </div>
          </AlertDialog.Popup>
        </Transition>
      </AlertDialog.Portal>
    </template>
  </AlertDialog.Root>
</template>
