<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';

const backdropHiddenClass = 'opacity-0';
const popupHiddenClass =
  'top-[calc(50%+0.25rem+1.25rem*var(--nested-dialogs))]! scale-[0.96]! opacity-0';
</script>

<template>
  <Dialog.Root>
    <Dialog.Trigger
      class="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-disabled:bg-neutral-100 dark:hover:not-disabled:bg-neutral-800 active:not-disabled:bg-neutral-200 dark:active:not-disabled:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
      >View notifications</Dialog.Trigger
    >
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
          class="fixed top-[calc(50%+1.25rem*var(--nested-dialogs))] left-1/2 -mt-8 flex w-96 max-w-[calc(100%-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 scale-[calc(1-0.1*var(--nested-dialogs))] bg-white dark:bg-neutral-950 p-4 text-neutral-950 dark:text-white border border-neutral-950 dark:border-white shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:shadow-none transition-[top,scale,opacity] duration-100 ease-out after:absolute after:inset-0 after:bg-black/5 after:opacity-0 after:transition-opacity after:duration-100 after:ease-out after:pointer-events-none data-nested-dialog-open:after:opacity-100"
        >
          <div class="flex flex-col gap-1">
            <Dialog.Title class="text-base font-bold">Notifications</Dialog.Title>
            <Dialog.Description class="text-sm text-neutral-600 dark:text-neutral-400">
              You are all caught up. Good job!
            </Dialog.Description>
          </div>
          <div class="flex items-center gap-3">
            <Dialog.Root>
              <Dialog.Trigger
                class="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-disabled:bg-neutral-100 dark:hover:not-disabled:bg-neutral-800 active:not-disabled:bg-neutral-200 dark:active:not-disabled:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                >Customize</Dialog.Trigger
              >
              <Dialog.Portal>
                <Transition
                  :enter-from-class="popupHiddenClass"
                  :leave-to-class="popupHiddenClass"
                  appear
                >
                  <Dialog.Popup
                    class="fixed top-[calc(50%+1.25rem*var(--nested-dialogs))] left-1/2 -mt-8 flex w-96 max-w-[calc(100%-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 scale-[calc(1-0.1*var(--nested-dialogs))] bg-white dark:bg-neutral-950 p-4 text-neutral-950 dark:text-white border border-neutral-950 dark:border-white shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:shadow-none transition-[top,scale,opacity] duration-100 ease-out after:absolute after:inset-0 after:bg-black/5 after:opacity-0 after:transition-opacity after:duration-100 after:ease-out after:pointer-events-none data-nested-dialog-open:after:opacity-100"
                  >
                    <div class="flex flex-col gap-1">
                      <Dialog.Title class="text-base font-bold"
                        >Customize notifications</Dialog.Title
                      >
                      <Dialog.Description class="text-sm text-neutral-600 dark:text-neutral-400">
                        Review your settings here.
                      </Dialog.Description>
                    </div>
                    <div class="flex items-center justify-end gap-3">
                      <Dialog.Close
                        class="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-disabled:bg-neutral-100 dark:hover:not-disabled:bg-neutral-800 active:not-disabled:bg-neutral-200 dark:active:not-disabled:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                        >Close</Dialog.Close
                      >
                    </div>
                  </Dialog.Popup>
                </Transition>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </Dialog.Popup>
      </Transition>
    </Dialog.Portal>
  </Dialog.Root>
</template>
