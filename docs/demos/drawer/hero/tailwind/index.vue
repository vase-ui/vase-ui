<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';

const backdropHiddenClass = 'opacity-0!';
const backdropLeavingClass = 'duration-[calc(var(--drawer-swipe-strength)*400ms)]!';
const popupHiddenClass =
  '[transform:translateX(calc(100%-var(--bleed)+var(--viewport-padding)+2px))]!';
const popupLeavingClass = 'duration-[calc(var(--drawer-swipe-strength)*400ms)]!';
</script>

<template>
  <Drawer.Root swipe-direction="right">
    <Drawer.Trigger
      class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-disabled:bg-neutral-100 active:not-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-disabled:bg-neutral-800 dark:active:not-disabled:bg-neutral-700 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
      >Open drawer</Drawer.Trigger
    >
    <Drawer.Portal>
      <Transition
        :enter-from-class="backdropHiddenClass"
        :leave-to-class="backdropHiddenClass"
        :leave-active-class="backdropLeavingClass"
      >
        <Drawer.Backdrop
          class="[--backdrop-opacity:0.2] [--bleed:3rem] dark:[--backdrop-opacity:0.7] fixed inset-0 bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute supports-[-webkit-touch-callout:none]:min-h-dvh"
        />
      </Transition>
      <Drawer.Viewport
        class="[--viewport-padding:0px] supports-[-webkit-touch-callout:none]:[--viewport-padding:0.625rem] fixed inset-0 flex items-stretch justify-end p-(--viewport-padding)"
      >
        <Transition
          :enter-from-class="popupHiddenClass"
          :leave-to-class="popupHiddenClass"
          :leave-active-class="popupLeavingClass"
        >
          <Drawer.Popup
            class="[--bleed:3rem] supports-[-webkit-touch-callout:none]:[--bleed:0px] h-full w-[calc(20rem+3rem)] max-w-[calc(100%-3rem+3rem)] -mr-[3rem] border-l border-neutral-950 bg-white p-6 pr-[calc(1.5rem+3rem)] text-neutral-950 outline-none shadow-[0.25rem_0.25rem_0] shadow-black/12 overflow-y-auto overscroll-contain touch-auto [transform:translateX(var(--drawer-swipe-movement-x))] transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:select-none supports-[-webkit-touch-callout:none]:mr-0 supports-[-webkit-touch-callout:none]:w-[20rem] supports-[-webkit-touch-callout:none]:max-w-[calc(100vw-3rem)] supports-[-webkit-touch-callout:none]:border supports-[-webkit-touch-callout:none]:pr-6 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
          >
            <Drawer.Content class="mx-auto w-full max-w-[32rem]">
              <Drawer.Title class="mb-1 text-base font-bold">Drawer</Drawer.Title>
              <Drawer.Description class="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
                This is a drawer that slides in from the side. You can swipe to dismiss it.
              </Drawer.Description>
              <div class="flex justify-end gap-3">
                <Drawer.Close
                  class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-disabled:bg-neutral-100 active:not-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-disabled:bg-neutral-800 dark:active:not-disabled:bg-neutral-700 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                  >Close</Drawer.Close
                >
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Transition>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
</template>
