<script setup lang="ts">
import { shallowRef } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';

const backdropHiddenClass = 'opacity-0';
const popupHiddenClass = 'scale-[0.98] opacity-0';

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
  <div class="flex flex-wrap gap-2 justify-center">
    <Dialog.Trigger
      id="trigger-1"
      class="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-disabled:bg-neutral-100 dark:hover:not-disabled:bg-neutral-800 active:not-disabled:bg-neutral-200 dark:active:not-disabled:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
      :handle="demoDialog"
      :payload="1"
    >
      Open 1
    </Dialog.Trigger>

    <Dialog.Trigger
      id="trigger-2"
      class="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-disabled:bg-neutral-100 dark:hover:not-disabled:bg-neutral-800 active:not-disabled:bg-neutral-200 dark:active:not-disabled:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
      :handle="demoDialog"
      :payload="2"
    >
      Open 2
    </Dialog.Trigger>

    <Dialog.Trigger
      id="trigger-3"
      class="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-disabled:bg-neutral-100 dark:hover:not-disabled:bg-neutral-800 active:not-disabled:bg-neutral-200 dark:active:not-disabled:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
      :handle="demoDialog"
      :payload="3"
    >
      Open 3
    </Dialog.Trigger>

    <button
      class="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
      type="button"
      @click="openProgrammatically"
    >
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
        <Transition
          :enter-from-class="backdropHiddenClass"
          :leave-to-class="backdropHiddenClass"
          appear
        >
          <Dialog.Backdrop
            class="fixed inset-0 bg-black/20 dark:bg-black/50 transition-opacity duration-150 supports-[-webkit-touch-callout:none]:absolute supports-[-webkit-touch-callout:none]:min-h-dvh"
          />
        </Transition>
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass" appear>
          <Dialog.Popup
            class="fixed top-1/2 left-1/2 -mt-8 flex w-96 max-w-[calc(100%-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 bg-white dark:bg-neutral-950 p-4 text-neutral-950 dark:text-white border border-neutral-950 dark:border-white shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:shadow-none transition-[scale,opacity] duration-100 ease-out"
          >
            <Dialog.Title v-if="payload !== undefined" class="text-base font-bold">
              Dialog {{ payload }}
            </Dialog.Title>
            <div class="flex justify-end gap-3">
              <Dialog.Close
                class="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-disabled:bg-neutral-100 dark:hover:not-disabled:bg-neutral-800 active:not-disabled:bg-neutral-200 dark:active:not-disabled:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                >Close</Dialog.Close
              >
            </div>
          </Dialog.Popup>
        </Transition>
      </Dialog.Portal>
    </template>
  </Dialog.Root>
</template>
