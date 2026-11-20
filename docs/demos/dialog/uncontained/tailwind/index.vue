<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';

const backdropHiddenClass = 'opacity-0';
const popupHiddenClass = 'opacity-0';
const panelEnterFromClass = 'scale-105';

const XIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      style: { display: 'block' },
    },
    [h('path', { d: 'm2.5 2.5 11 11m-11 0 11-11' })],
  );
</script>

<template>
  <Dialog.Root>
    <Dialog.Trigger
      class="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-disabled:bg-neutral-100 dark:hover:not-disabled:bg-neutral-800 active:not-disabled:bg-neutral-200 dark:active:not-disabled:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
      >Open dialog</Dialog.Trigger
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
      <Dialog.Viewport class="fixed inset-0 grid place-items-center px-4 py-12 xl:py-6">
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass" appear>
          <Dialog.Popup
            aria-label="Uncontained dialog"
            class="relative flex h-full w-full max-w-[70rem] xl:max-w-none justify-center pointer-events-none transition-opacity duration-150"
          >
            <Dialog.Close
              class="absolute right-0 -top-10 flex h-8 w-8 items-center justify-center border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 text-neutral-950 dark:text-white shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:shadow-none hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 xl:top-0 pointer-events-auto focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
              aria-label="Close"
            >
              <XIcon />
            </Dialog.Close>
            <Transition :enter-from-class="panelEnterFromClass" appear>
              <div
                class="pointer-events-auto h-full w-full max-w-[70rem] bg-white dark:bg-neutral-950 p-4 text-neutral-950 dark:text-white border border-neutral-950 dark:border-white shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:shadow-none transition-[scale] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              />
            </Transition>
          </Dialog.Popup>
        </Transition>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
</template>
