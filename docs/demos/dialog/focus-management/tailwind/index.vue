<script setup lang="ts">
import { useId, useTemplateRef } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';

const backdropHiddenClass = 'opacity-0';
const popupHiddenClass = 'scale-[0.98] opacity-0';

const initialFocusRef = useTemplateRef<HTMLInputElement>('initialFocus');
const finalFocusRef = useTemplateRef<HTMLButtonElement>('finalFocus');
const nameId = useId();
const feedbackId = useId();
</script>

<template>
  <div class="flex flex-wrap justify-center gap-3">
    <Dialog.Root>
      <Dialog.Trigger
        class="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-disabled:bg-neutral-100 dark:hover:not-disabled:bg-neutral-800 active:not-disabled:bg-neutral-200 dark:active:not-disabled:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
        >Open feedback</Dialog.Trigger
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
            class="fixed top-1/2 left-1/2 -mt-8 flex w-96 max-w-[calc(100%-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 bg-white dark:bg-neutral-950 p-4 text-neutral-950 dark:text-white border border-neutral-950 dark:border-white shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:shadow-none transition-[scale,opacity] duration-100 ease-out"
            :initial-focus="initialFocusRef"
            :final-focus="finalFocusRef"
          >
            <div class="flex flex-col gap-1">
              <Dialog.Title class="text-base font-bold">Feedback form</Dialog.Title>
              <Dialog.Description class="text-sm text-neutral-600 dark:text-neutral-400">
                Your feedback means a lot to us.
              </Dialog.Description>
            </div>
            <div class="flex flex-col gap-3">
              <div class="flex flex-col items-start gap-1">
                <label :for="nameId" class="text-sm font-normal">Full name</label>
                <input
                  :id="nameId"
                  placeholder="Enter your name"
                  class="h-8 w-full border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white"
                />
              </div>
              <div class="flex flex-col items-start gap-1">
                <label :for="feedbackId" class="text-sm font-normal">Feedback</label>
                <input
                  :id="feedbackId"
                  ref="initialFocus"
                  required
                  placeholder="Enter your feedback"
                  class="h-8 w-full border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white"
                />
              </div>
            </div>
            <div class="flex justify-end gap-3">
              <Dialog.Close
                class="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-disabled:bg-neutral-100 dark:hover:not-disabled:bg-neutral-800 active:not-disabled:bg-neutral-200 dark:active:not-disabled:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                >Close</Dialog.Close
              >
            </div>
          </Dialog.Popup>
        </Transition>
      </Dialog.Portal>
    </Dialog.Root>
    <button
      ref="finalFocus"
      type="button"
      class="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
    >
      Final focus
    </button>
  </div>
</template>
